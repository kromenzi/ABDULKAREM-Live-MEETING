/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ABDULKAREM LIVE MEETING — ENTERPRISE AUTH & SECURITY ENGINE
 */

import crypto from 'crypto';
import { Role, AuthUser } from '../types';

const JWT_ISSUER = 'abdulkarem-hse-enterprise';
const JWT_AUDIENCE = 'abdulkarem-meeting-participants';
const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours

export function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (!envSecret || envSecret.trim().length < 32) {
    // P0 Constraint: Must fail securely if authentication settings are missing or weak
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or insecure (< 32 characters). Server refuses to issue or verify tokens.');
  }
  return envSecret.trim();
}

// Blacklist of revoked JWT IDs / tokens
const revokedTokens = new Set<string>();
const revokedJtis = new Set<string>();

/**
 * Password Hashing & Verification (scrypt with cryptographically random salt)
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (computedBuffer.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Base64URL encode and decode utilities
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  role: Role;
  companyId: string;
  siteId?: string;
  projectId?: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Issue a cryptographically signed HMAC-SHA256 JWT
 */
export function signJwt(
  user: {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    companyId: string;
    siteId?: string;
    projectId?: string;
  },
  expiresInSeconds = TOKEN_EXPIRY_SECONDS
): string {
  const secret = getJwtSecret();
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    companyId: user.companyId,
    siteId: user.siteId,
    projectId: user.projectId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + expiresInSeconds,
    jti,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

/**
 * Verify JWT signature, expiration, issuer, audience, and revocation
 */
export function verifyJwt(token: string): { valid: boolean; payload?: JwtPayload; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or invalid type' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT structure' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Check revocation
  if (revokedTokens.has(token)) {
    return { valid: false, error: 'Token has been revoked' };
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (err: any) {
    return { valid: false, error: err.message };
  }

  // Verify HMAC-SHA256 signature with constant-time equality
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    // Required claims and strict time validation
    if (!payload || typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' ||
        typeof payload.displayName !== 'string' || typeof payload.companyId !== 'string' || !payload.companyId ||
        typeof payload.jti !== 'string' || !payload.jti || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
      return { valid: false, error: 'Invalid token claims' };
    }
    if (revokedJtis.has(payload.jti)) {
      return { valid: false, error: 'Token has been revoked' };
    }

    // Check expiration and issued-at sanity
    if (payload.exp <= now || payload.iat > now + 60 || payload.exp <= payload.iat) {
      return { valid: false, error: 'Token has expired' };
    }

    // Check issuer
    if (payload.iss !== JWT_ISSUER) {
      return { valid: false, error: 'Invalid token issuer' };
    }

    // Check audience
    if (payload.aud !== JWT_AUDIENCE) {
      return { valid: false, error: 'Invalid token audience' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Failed to parse token payload' };
  }
}

/**
 * Revoke a token
 */
export function revokeJwt(token: string) {
  const result = verifyJwt(token);
  revokedTokens.add(token);
  if (result.payload?.jti) revokedJtis.add(result.payload.jti);
}

/**
 * Generate secure cryptographically random invitation token
 */
export function generateSecureInviteToken(prefix = 'inv'): string {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Role Hierarchy Validation:
 * Prevents creating invitations with privileges equal to or higher than creator
 */
export function canAssignRoleInInvitation(creatorRole: Role, targetRole: Role): boolean {
  if (creatorRole === 'admin') {
    // Admin can invite hosts, co-hosts, HSE personnel, participants
    return targetRole !== 'admin';
  }
  if (creatorRole === 'host') {
    // Host can invite co-hosts, HSE personnel, participants. Cannot invite Admin or another Host
    return targetRole === 'co-host' || targetRole === 'participant' || targetRole === 'hse_officer';
  }
  if (creatorRole === 'co-host') {
    // Co-host can only invite participants
    return targetRole === 'participant';
  }
  // Participants and HSE officers cannot create invitations
  return false;
}

/**
 * Enterprise Rate Limiter (Token Bucket Algorithm)
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private readonly maxTokens: number;
  private readonly refillRatePerSecond: number;

  constructor(maxTokens = 30, refillRatePerSecond = 15) {
    this.maxTokens = maxTokens;
    this.refillRatePerSecond = refillRatePerSecond;
  }

  public allow(clientId: string, cost = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(clientId, bucket);
    } else {
      const elapsedSeconds = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsedSeconds * this.refillRatePerSecond);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }

    return false;
  }

  public cleanup(olderThanMinutes = 30) {
    const threshold = Date.now() - olderThanMinutes * 60 * 1000;
    for (const [key, val] of this.buckets.entries()) {
      if (val.lastRefill < threshold) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Enterprise Ephemeral TURN credentials generation (RFC 5766 time-window HMAC-SHA1)
 */
export function generateEphemeralTurnCredentials(userId: string, ttlSeconds = 86400) {
  const turnSecret = process.env.TURN_SECRET;
  if (!turnSecret || turnSecret.trim().length < 16) {
    throw new Error('FATAL SECURITY ERROR: TURN_SECRET environment variable is missing or insecure (< 16 characters).');
  }
  const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${timestamp}:${userId}`;

  const hmac = crypto.createHmac('sha1', turnSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  const turnUrls = (process.env.TURN_URLS || '').split(',').map((url) => url.trim()).filter(Boolean);
  if (!turnUrls.length) throw new Error('TURN_URLS is missing; refusing to issue unusable relay credentials');
  const stunUrls = (process.env.STUN_URLS || '').split(',').map((url) => url.trim()).filter(Boolean);
  const iceServers = [
    ...stunUrls.map((urls) => ({ urls })),
    {
      urls: turnUrls,
      username: username,
      credential: credential,
    },
  ];

  return {
    iceServers,
    ttlSeconds,
    expiresAt: timestamp * 1000,
  };
}
