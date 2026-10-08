import 'dotenv/config';
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  signJwt,
  verifyJwt,
  verifyPassword,
  hashPassword,
  RateLimiter,
  generateSecureInviteToken,
  generateEphemeralTurnCredentials,
  canAssignRoleInInvitation,
  JwtPayload,
} from './src/server/auth.js';
import { db } from './src/server/db.js';
import {
  summarizeMeetingWithGemini,
  extractActionsWithGemini,
  searchMinutesWithGemini,
} from './src/server/ai.js';
import {
  listHseProjects,
  getHseProjectDetails,
  formatHseComplianceHeader,
} from './src/server/hse.js';
import { Role } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = parseInt(process.env.PORT || '3000', 10);

app.set('trust proxy', process.env.TRUST_PROXY === 'true');
app.use(express.json({ limit: '1mb' }));
app.disable('x-powered-by');
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
app.use((req, res, next) => { const origin = req.headers.origin as string | undefined; if (origin && !allowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' }); if (origin) res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });

interface ClientSession {
  ws: WebSocket;
  peerId: string;
  userId: string;
  roomId: string;
  displayName: string;
  role: Role;
  companyId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isAlive: boolean;
  ip: string;
  joinedAt: number;
}

// Active clients & room management
const clients = new Map<string, ClientSession>(); // peerId -> ClientSession
const rooms = new Map<string, Set<string>>(); // roomId -> Set of peerIds
const waitingLobby = new Map<string, Map<string, { peerId: string; userId: string; displayName: string; role: Role; ws: WebSocket }>>();
const admittedSockets = new Set<WebSocket>();

// Rate limiters
const wsRateLimiter = new RateLimiter(35, 15);
const turnRateLimiter = new RateLimiter(15, 1);
const loginRateLimiter = new RateLimiter(8, 0.1);

setInterval(() => {
  wsRateLimiter.cleanup();
  turnRateLimiter.cleanup();
  loginRateLimiter.cleanup();
}, 10 * 60 * 1000);

// WebSocket Server for WebRTC Signaling with strict authentication & validation
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 131072 });

function canModerateRoom(client: ClientSession, meeting: { hostId: string; roomCode: string }): boolean {
  // P0 Constraint: Separate System Admin from Meeting Host.
  // In-room moderation (muting, kicking, locking) belongs exclusively to:
  // 1. The assigned Host of THIS specific room
  // 2. An assigned Co-host in THIS room
  // System administrators manage system-level assets (audit logs, users) but do NOT hijack room host powers.
  if (client.userId === meeting.hostId) return true;
  if (client.role === 'co-host' && db.isMeetingCohost(meeting.roomCode, client.userId)) return true;
  return false;
}

function getClientIp(req: express.Request): string {
  if (process.env.TRUST_PROXY === 'true') return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  return req.socket.remoteAddress || 'unknown';
}

function getBearerToken(req: express.Request): string | null {
  const value = req.headers.authorization;
  if (!value || !/^Bearer\s+[^\s]+$/i.test(value)) return null;
  return value.replace(/^Bearer\s+/i, '').trim();
}

function authenticateRequest(req: express.Request): JwtPayload | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const result = verifyJwt(token);
  if (!result.valid || !result.payload) return null;
  // JWT claims are not the source of truth: re-read the current account.
  const user = db.getUserById(result.payload.sub);
  if (!user || user.email !== result.payload.email || user.companyId !== result.payload.companyId || user.role !== result.payload.role) return null;
  return { ...result.payload, email: user.email, displayName: user.displayName, role: user.role, companyId: user.companyId, siteId: user.siteId };
}

function requireAuth(req: express.Request, res: express.Response): JwtPayload | null {
  const user = authenticateRequest(req);
  if (!user) { res.status(401).json({ error: 'Authentication required' }); return null; }
  return user;
}

function canAccessMeeting(user: JwtPayload, roomCode: string): boolean {
  const meeting = db.getMeeting(roomCode);
  if (!meeting || meeting.companyId !== user.companyId) return false;
  return meeting.hostId === user.sub || user.role === 'admin' || !!db.listMeetings(user.companyId, user.sub).find((m) => m.roomCode === roomCode);
}

function allowedOrigin(origin: string | undefined): boolean {
  if (!origin) return process.env.NODE_ENV !== 'production';
  const configured = (process.env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
  return configured.includes(origin) || (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
}

wss.on('connection', (ws, req) => {
  let currentPeerId: string | null = null;
  let currentRoomId: string | null = null;
  let authenticatedUser: JwtPayload | null = null;
  let guestIdentity: { userId: string; companyId: string; role: Role; displayName: string; roomId: string } | null = null;
  const clientIp = process.env.TRUST_PROXY === 'true' ? ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1') : (req.socket.remoteAddress || '127.0.0.1');

  let isAlive = true;
  ws.on('pong', () => {
    isAlive = true;
    if (currentPeerId && clients.has(currentPeerId)) {
      clients.get(currentPeerId)!.isAlive = true;
    }
  });

  if (!allowedOrigin(req.headers.origin as string | undefined)) { ws.close(1008, 'Origin not allowed'); return; }

  ws.on('message', (messageRaw) => {
    // Check message size (Runtime constraint P0)
    if (messageRaw.toString().length > 65536) {
      ws.send(JSON.stringify({ type: 'auth-error', error: 'Payload size exceeds allowable 64KB limit' }));
      return;
    }

    // Rate Limiting
    const rateLimitKey = currentPeerId || clientIp;
    if (!wsRateLimiter.allow(rateLimitKey)) {
      ws.send(JSON.stringify({ type: 'auth-error', error: 'Rate limit exceeded. Please throttle messaging.' }));
      db.logAudit({
        actorId: currentPeerId || 'anonymous',
        actorName: authenticatedUser?.displayName || 'Unknown',
        actorRole: authenticatedUser?.role || 'participant',
        action: 'RATE_LIMIT_EXCEEDED',
        ip: clientIp,
        details: { peerId: currentPeerId },
      });
      return;
    }

    try {
      const data = JSON.parse(messageRaw.toString());
      if (!data || typeof data !== 'object' || !data.type) {
        ws.send(JSON.stringify({ type: 'auth-error', error: 'Invalid message structure' }));
        return;
      }

      const { type } = data;

      if (type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      if (type === 'auth-token') {
        if (currentPeerId || currentRoomId || authenticatedUser || guestIdentity) { ws.close(1008, 'Authentication state cannot change after join'); return; }
        const token = data.token;
        const verifyResult = verifyJwt(token);
        if (!verifyResult.valid || !verifyResult.payload) {
          ws.send(JSON.stringify({ type: 'auth-error', error: verifyResult.error || 'Invalid or expired authentication token' }));
          return;
        }
        authenticatedUser = verifyResult.payload;
        ws.send(JSON.stringify({ type: 'auth-success', user: authenticatedUser }));
        return;
      }

      switch (type) {
        case 'join-room': {
          const { roomId, peerId, displayName, isMuted = false, isCameraOff = false, token, inviteToken } = data;
          if (!roomId || !peerId || typeof roomId !== 'string' || typeof peerId !== 'string' || roomId.length > 128 || peerId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(roomId) || !/^[A-Za-z0-9._:-]+$/.test(peerId)) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'RoomId and PeerId are required' }));
            return;
          }

          // Authenticate via token passed in payload or already established in connection
          // Authentication must be established by the auth-token message; never accept query-string JWTs.
          if (token || data.token) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Send authentication using the auth-token message, not join-room data' }));
            return;
          }

          let effectiveRole: Role = 'participant';
          let userCompanyId = '';
          let userId = `user-${peerId}`;

          if (authenticatedUser) {
            effectiveRole = authenticatedUser.role;
            userCompanyId = authenticatedUser.companyId;
            userId = authenticatedUser.sub;
          } else if (inviteToken) {
            // P0: Verify invitation is bound to this specific roomId!
            const fullInv = db.getInvitation(inviteToken);
            if (!fullInv) {
              ws.send(JSON.stringify({ type: 'auth-error', error: 'Invitation not found or invalid' }));
              return;
            }
            const inviteResult = db.verifyAndConsumeInvitation(inviteToken, roomId);
            if (!inviteResult.valid || !inviteResult.invitation) {
              ws.send(JSON.stringify({ type: 'auth-error', error: inviteResult.reason || 'Invalid or mismatched invitation token' }));
              db.logAudit({
                actorId: peerId,
                actorName: displayName || 'Guest',
                actorRole: 'unauthenticated',
                action: 'INVALID_INVITATION_ATTEMPT',
                ip: clientIp,
                details: { roomId },
              });
              return;
            }
            effectiveRole = inviteResult.invitation.role;
            userCompanyId = fullInv.companyId;
            userId = `invitee-${peerId.slice(0, 8)}`;
            guestIdentity = { userId, companyId: userCompanyId, role: effectiveRole, displayName: String(displayName || 'Guest').slice(0, 128), roomId };
          } else if (guestIdentity && guestIdentity.roomId === roomId) {
            effectiveRole = guestIdentity.role;
            userCompanyId = guestIdentity.companyId;
            userId = guestIdentity.userId;
          } else {
            // P0 Constraint: Deny unauthenticated joining without valid JWT or invite token
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Authentication required. Please provide a valid JWT or invitation token.' }));
            db.logAudit({
              actorId: peerId,
              actorName: displayName || 'Anonymous',
              actorRole: 'unauthenticated',
              action: 'UNAUTHENTICATED_JOIN_DENIED',
              ip: clientIp,
              details: { roomId },
            });
            return;
          }

          if (!userCompanyId) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'User corporate profile is missing valid company identification' }));
            return;
          }

          const userDisplayName = (authenticatedUser?.displayName || guestIdentity?.displayName || displayName || 'Guest').toString().slice(0, 128);

          // Prevent duplicate active connections for same peerId
          if (clients.has(peerId)) {
            const oldClient = clients.get(peerId)!;
            try {
              oldClient.ws.send(JSON.stringify({ type: 'kicked-by-host', reason: 'Session replaced by new connection' }));
              oldClient.ws.close();
            } catch {
              // ignore
            }
            clients.delete(peerId);
          }

          // Clean up old room if switching
          if (currentRoomId && currentRoomId !== roomId && rooms.has(currentRoomId)) {
            const oldPeers = rooms.get(currentRoomId)!;
            oldPeers.delete(peerId);
            const leaveMsg = JSON.stringify({ type: 'user-left', peerId, displayName: userDisplayName });
            oldPeers.forEach((pId) => {
              const target = clients.get(pId);
              if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(leaveMsg);
              }
            });
          }

          currentPeerId = peerId;
          currentRoomId = roomId;

          // Retrieve or create meeting in persistent database
          let meeting = db.getMeeting(roomId);
          if (!meeting) {
            // Meeting creation is restricted to users with role 'host', 'admin', or 'hse_manager'
            if (effectiveRole === 'host' || effectiveRole === 'admin' || effectiveRole === 'hse_manager') {
              meeting = db.createOrGetMeeting(roomId, userId, userCompanyId, `Meeting - ${roomId}`);
              db.logAudit({
                actorId: userId,
                actorName: userDisplayName,
                actorRole: effectiveRole,
                action: 'MEETING_CREATED',
                ip: clientIp,
                details: { roomId },
              });
            } else {
              // Standard participant cannot auto-create rooms as host
              ws.send(JSON.stringify({ type: 'auth-error', error: 'Meeting does not exist. Only authorized hosts can create meetings.' }));
              return;
            }
          }

          // P0 Constraint: Cross-company access control
          // If meeting belongs to Company A and user is from Company B, they MUST possess a valid invitation!
          const meetingCompany = meeting.companyId || meeting.hseContext?.companyId;
          if (meetingCompany && userCompanyId !== meetingCompany) {
            if (!inviteToken) {
              ws.send(JSON.stringify({
                type: 'auth-error',
                error: `Cross-company access denied. Room belongs to company "${meetingCompany}". An authorized invitation is required to participate.`,
              }));
              db.logAudit({
                actorId: userId,
                actorName: userDisplayName,
                actorRole: effectiveRole,
                action: 'CROSS_COMPANY_ACCESS_DENIED',
                ip: clientIp,
                details: { roomId, targetCompany: meetingCompany, userCompany: userCompanyId },
              });
              return;
            }
          }

          // P0 Constraint: Separate System Admin from Meeting Host.
          // Host status is granted ONLY if user is the assigned host of THIS meeting.
          const isHostOfThisRoom = meeting.hostId === userId;

          // Check if meeting is locked
          if (meeting.isLocked && !isHostOfThisRoom && effectiveRole !== 'co-host') {
            ws.send(JSON.stringify({ type: 'room-locked', roomId }));
            db.logAudit({
              actorId: userId,
              actorName: userDisplayName,
              actorRole: effectiveRole,
              action: 'JOIN_LOCKED_ROOM_DENIED',
              ip: clientIp,
              details: { roomId },
            });
            return;
          }

          // Check Waiting Room
          if (meeting.waitingRoomEnabled && !isHostOfThisRoom && effectiveRole !== 'co-host' && !admittedSockets.has(ws)) {
            if (!waitingLobby.has(roomId)) {
              waitingLobby.set(roomId, new Map());
            }
            const lobby = waitingLobby.get(roomId)!;
            lobby.set(peerId, { peerId, userId, displayName: userDisplayName, role: effectiveRole, ws });

            ws.send(JSON.stringify({ type: 'waiting-in-lobby', roomId }));

            // Notify moderators in the room
            const roomPeers = rooms.get(roomId);
            if (roomPeers) {
              const knockMsg = JSON.stringify({
                type: 'lobby-knock',
                peerId,
                displayName: userDisplayName,
                role: effectiveRole,
              });
              roomPeers.forEach((pId) => {
                const target = clients.get(pId);
                if (target && canModerateRoom(target, meeting!) && target.ws.readyState === WebSocket.OPEN) {
                  target.ws.send(knockMsg);
                }
              });
            }

            db.logAudit({
              actorId: userId,
              actorName: userDisplayName,
              actorRole: effectiveRole,
              action: 'ENTERED_WAITING_ROOM',
              ip: clientIp,
              details: { roomId },
            });
            return;
          }

          // Register active client session
          clients.set(peerId, {
            ws,
            peerId,
            userId,
            roomId,
            displayName: userDisplayName,
            role: effectiveRole,
            companyId: userCompanyId,
            isMuted: !!isMuted,
            isCameraOff: !!isCameraOff,
            isScreenSharing: false,
            isHandRaised: false,
            isAlive: true,
            ip: clientIp,
            joinedAt: Date.now(),
          });

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          const roomPeers = rooms.get(roomId)!;

          // Collect existing participants
          const existingParticipants = Array.from(roomPeers)
            .map((pId) => {
              const c = clients.get(pId);
              if (!c) return null;
              return {
                peerId: c.peerId,
                userId: c.userId,
                displayName: c.displayName,
                role: c.role,
                isMuted: c.isMuted,
                isCameraOff: c.isCameraOff,
                isScreenSharing: c.isScreenSharing,
                isHandRaised: c.isHandRaised,
                isHost: meeting!.hostId === c.userId,
              };
            })
            .filter(Boolean);

          roomPeers.add(peerId);

          // Reply with current peer list and security state
          ws.send(
            JSON.stringify({
              type: 'room-joined',
              roomId,
              peerId,
              userId,
              role: effectiveRole,
              isHost: isHostOfThisRoom,
              isLocked: meeting.isLocked,
              waitingRoomEnabled: meeting.waitingRoomEnabled,
              participants: existingParticipants,
            })
          );

          // Notify other participants
          const userJoinedPayload = JSON.stringify({
            type: 'user-joined',
            peerId,
            userId,
            displayName: userDisplayName,
            role: effectiveRole,
            isMuted: !!isMuted,
            isCameraOff: !!isCameraOff,
            isScreenSharing: false,
            isHandRaised: false,
            isHost: isHostOfThisRoom,
          });

          roomPeers.forEach((pId) => {
            if (pId !== peerId) {
              const other = clients.get(pId);
              if (other && other.ws.readyState === WebSocket.OPEN) {
                other.ws.send(userJoinedPayload);
              }
            }
          });

          db.logAudit({
            actorId: userId,
            actorName: userDisplayName,
            actorRole: effectiveRole,
            action: 'USER_JOINED_ROOM',
            ip: clientIp,
            details: { roomId },
          });
          break;
        }

        // WebRTC Signaling relays
        case 'signal-offer': {
          const { to, offer } = data;
          if (!to || !offer) return;
          const target = clients.get(to);
          if (target && target.roomId === currentRoomId && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'signal-offer', from: currentPeerId, offer }));
          }
          break;
        }

        case 'signal-answer': {
          const { to, answer } = data;
          if (!to || !answer) return;
          const target = clients.get(to);
          if (target && target.roomId === currentRoomId && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'signal-answer', from: currentPeerId, answer }));
          }
          break;
        }

        case 'signal-candidate': {
          const { to, candidate } = data;
          if (!to || !candidate) return;
          const target = clients.get(to);
          if (target && target.roomId === currentRoomId && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'signal-candidate', from: currentPeerId, candidate }));
          }
          break;
        }

        case 'ice-restart-offer': {
          const { to, offer } = data;
          if (!to || !offer) return;
          const target = clients.get(to);
          if (target && target.roomId === currentRoomId && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ type: 'ice-restart-offer', from: currentPeerId, offer }));
          }
          break;
        }

        case 'status-update': {
          if (!currentPeerId || !currentRoomId) return;
          const client = clients.get(currentPeerId);
          if (client) {
            if (data.isMuted !== undefined) client.isMuted = !!data.isMuted;
            if (data.isCameraOff !== undefined) client.isCameraOff = !!data.isCameraOff;
            if (data.isScreenSharing !== undefined) client.isScreenSharing = !!data.isScreenSharing;
            if (data.isHandRaised !== undefined) client.isHandRaised = !!data.isHandRaised;
            if (data.displayName !== undefined) client.displayName = String(data.displayName).slice(0, 128);
          }

          const roomPeers = rooms.get(currentRoomId);
          if (roomPeers) {
            const payload = JSON.stringify({ type: 'peer-status-updated', peerId: currentPeerId, ...data });
            roomPeers.forEach((pId) => {
              if (pId !== currentPeerId) {
                const target = clients.get(pId);
                if (target && target.ws.readyState === WebSocket.OPEN) {
                  target.ws.send(payload);
                }
              }
            });
          }
          break;
        }

        case 'chat-message': {
          if (!currentRoomId || !currentPeerId) return;
          const client = clients.get(currentPeerId);
          if (!client) return;

          const text = (data.text || '').toString().trim().slice(0, 4000);
          if (!text) return;

          const chatItem = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            from: currentPeerId,
            senderName: client.displayName,
            senderRole: client.role,
            text,
            timestamp: Date.now(),
          };

          db.addChatMessage(currentRoomId, chatItem);

          const roomPeers = rooms.get(currentRoomId);
          if (roomPeers) {
            const chatPayload = JSON.stringify({ type: 'chat-message', ...chatItem });
            roomPeers.forEach((pId) => {
              const target = clients.get(pId);
              if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(chatPayload);
              }
            });
          }
          break;
        }

        // Host & Moderation Commands with SERVER-SIDE PERMISSION ENFORCEMENT
        case 'mute-all': {
          const client = currentPeerId ? clients.get(currentPeerId) : null;
          const meeting = currentRoomId ? db.getMeeting(currentRoomId) : null;
          if (!client || !meeting || !canModerateRoom(client, meeting)) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Forbidden: Only host, co-host, or HSE manager can mute all participants.' }));
            db.logAudit({
              actorId: currentPeerId || 'anonymous',
              actorName: client?.displayName || 'User',
              actorRole: client?.role || 'participant',
              action: 'UNAUTHORIZED_MUTE_ALL_ATTEMPT',
              ip: clientIp,
              details: { roomId: currentRoomId },
            });
            return;
          }

          if (currentRoomId) {
            const roomPeers = rooms.get(currentRoomId);
            if (roomPeers) {
              const payload = JSON.stringify({ type: 'muted-by-host' });
              roomPeers.forEach((pId) => {
                if (pId !== currentPeerId) {
                  const target = clients.get(pId);
                  if (target && target.ws.readyState === WebSocket.OPEN) {
                    target.isMuted = true;
                    target.ws.send(payload);
                  }
                }
              });
            }

            db.logAudit({
              actorId: client.userId,
              actorName: client.displayName,
              actorRole: client.role,
              action: 'MUTED_ALL_PARTICIPANTS',
              ip: clientIp,
              details: { roomId: currentRoomId },
            });
          }
          break;
        }

        case 'kick-user': {
          const { targetPeerId } = data;
          const client = currentPeerId ? clients.get(currentPeerId) : null;
          const meeting = currentRoomId ? db.getMeeting(currentRoomId) : null;
          if (!client || !meeting || !canModerateRoom(client, meeting)) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Forbidden: Only host, co-host, or HSE manager can kick participants.' }));
            db.logAudit({
              actorId: currentPeerId || 'anonymous',
              actorName: client?.displayName || 'User',
              actorRole: client?.role || 'participant',
              action: 'UNAUTHORIZED_KICK_ATTEMPT',
              ip: clientIp,
              details: { targetPeerId, roomId: currentRoomId },
            });
            return;
          }

          if (targetPeerId) {
            const target = clients.get(targetPeerId);
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(JSON.stringify({ type: 'kicked-by-host' }));
              try {
                target.ws.close();
              } catch {
                // ignore
              }
            }

            db.logAudit({
              actorId: client.userId,
              actorName: client.displayName,
              actorRole: client.role,
              action: 'KICKED_PARTICIPANT',
              targetId: targetPeerId,
              ip: clientIp,
              details: { roomId: currentRoomId },
            });
          }
          break;
        }

        case 'lock-room': {
          const client = currentPeerId ? clients.get(currentPeerId) : null;
          const meeting = currentRoomId ? db.getMeeting(currentRoomId) : null;
          // P0: Only Host of this specific meeting can lock the room
          const isHost = meeting && meeting.hostId === client?.userId;
          if (!client || !meeting || !isHost) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Forbidden: Only the assigned meeting host can lock/unlock this room.' }));
            db.logAudit({
              actorId: currentPeerId || 'anonymous',
              actorName: client?.displayName || 'User',
              actorRole: client?.role || 'participant',
              action: 'UNAUTHORIZED_LOCK_ROOM_ATTEMPT',
              ip: clientIp,
              details: { roomId: currentRoomId },
            });
            return;
          }

          if (currentRoomId) {
            const isLocked = !!data.isLocked;
            db.updateMeeting(currentRoomId, { isLocked });

            const roomPeers = rooms.get(currentRoomId);
            if (roomPeers) {
              const payload = JSON.stringify({ type: 'room-lock-status', isLocked });
              roomPeers.forEach((pId) => {
                const target = clients.get(pId);
                if (target && target.ws.readyState === WebSocket.OPEN) {
                  target.ws.send(payload);
                }
              });
            }

            db.logAudit({
              actorId: client.userId,
              actorName: client.displayName,
              actorRole: client.role,
              action: isLocked ? 'ROOM_LOCKED' : 'ROOM_UNLOCKED',
              ip: clientIp,
              details: { roomId: currentRoomId, isLocked },
            });
          }
          break;
        }

        case 'toggle-waiting-room': {
          const client = currentPeerId ? clients.get(currentPeerId) : null;
          const meeting = currentRoomId ? db.getMeeting(currentRoomId) : null;
          const isHost = meeting && meeting.hostId === client?.userId;
          if (!client || !meeting || !isHost) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Forbidden: Only the assigned meeting host can toggle waiting room.' }));
            return;
          }

          if (currentRoomId) {
            const enabled = !!data.enabled;
            db.updateMeeting(currentRoomId, { waitingRoomEnabled: enabled });

            const roomPeers = rooms.get(currentRoomId);
            if (roomPeers) {
              const payload = JSON.stringify({ type: 'waiting-room-status', enabled });
              roomPeers.forEach((pId) => {
                const target = clients.get(pId);
                if (target && target.ws.readyState === WebSocket.OPEN) {
                  target.ws.send(payload);
                }
              });
            }

            db.logAudit({
              actorId: client.userId,
              actorName: client.displayName,
              actorRole: client.role,
              action: enabled ? 'WAITING_ROOM_ENABLED' : 'WAITING_ROOM_DISABLED',
              ip: clientIp,
              details: { roomId: currentRoomId, enabled },
            });
          }
          break;
        }

        case 'admit-user': {
          const client = currentPeerId ? clients.get(currentPeerId) : null;
          const meeting = currentRoomId ? db.getMeeting(currentRoomId) : null;
          if (!client || !meeting || !canModerateRoom(client, meeting)) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Forbidden: Insufficient permissions to admit guests.' }));
            return;
          }

          const { targetPeerId, roomId } = data;
          if (roomId !== currentRoomId) { ws.send(JSON.stringify({ type: 'auth-error', error: 'Room context mismatch' })); return; }
          const lobby = waitingLobby.get(currentRoomId!);
          if (lobby && lobby.has(targetPeerId)) {
            const guest = lobby.get(targetPeerId)!;
            lobby.delete(targetPeerId);
            admittedSockets.add(guest.ws);
            if (guest.ws.readyState === WebSocket.OPEN) {
              guest.ws.send(JSON.stringify({ type: 'lobby-admitted', roomId }));
            }

            db.logAudit({
              actorId: client.userId,
              actorName: client.displayName,
              actorRole: client.role,
              action: 'GUEST_ADMITTED',
              targetId: targetPeerId,
              ip: clientIp,
              details: { roomId },
            });
          }
          break;
        }

        case 'deny-user': {
          const client = currentPeerId ? clients.get(currentPeerId) : null;
          const meeting = currentRoomId ? db.getMeeting(currentRoomId) : null;
          if (!client || !meeting || !canModerateRoom(client, meeting)) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Forbidden: Insufficient permissions to deny guests.' }));
            return;
          }

          const { targetPeerId, roomId } = data;
          if (roomId !== currentRoomId) { ws.send(JSON.stringify({ type: 'auth-error', error: 'Room context mismatch' })); return; }
          const lobby = waitingLobby.get(currentRoomId!);
          if (lobby && lobby.has(targetPeerId)) {
            const guest = lobby.get(targetPeerId)!;
            lobby.delete(targetPeerId);
            admittedSockets.delete(guest.ws);
            if (guest.ws.readyState === WebSocket.OPEN) {
              guest.ws.send(JSON.stringify({ type: 'lobby-denied', roomId }));
            }

            db.logAudit({
              actorId: client.userId,
              actorName: client.displayName,
              actorRole: client.role,
              action: 'GUEST_DENIED',
              targetId: targetPeerId,
              ip: clientIp,
              details: { roomId },
            });
          }
          break;
        }

        case 'move-to-room': {
          const client = currentPeerId ? clients.get(currentPeerId) : null;
          const meeting = currentRoomId ? db.getMeeting(currentRoomId) : null;
          if (!client || !meeting || !canModerateRoom(client, meeting)) {
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Forbidden: Only moderators can move participants between rooms.' }));
            return;
          }

          const { targetPeerId, targetRoomId, breakoutName, mainRoomId } = data;
          if (!targetRoomId) return;

          const payload = JSON.stringify({
            type: 'move-to-room',
            targetPeerId,
            targetRoomId,
            breakoutName: breakoutName || targetRoomId,
            mainRoomId: mainRoomId || currentRoomId,
            initiatorName: client.displayName,
          });

          if (targetPeerId) {
            const targetClient = clients.get(targetPeerId);
            if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
              targetClient.ws.send(payload);
            }
          } else if (currentRoomId) {
            const roomPeers = rooms.get(currentRoomId);
            if (roomPeers) {
              roomPeers.forEach((pId) => {
                const targetClient = clients.get(pId);
                if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                  targetClient.ws.send(payload);
                }
              });
            }
          }
          break;
        }

        case 'live-caption': {
          if (!currentRoomId || !currentPeerId) return;
          const roomPeers = rooms.get(currentRoomId);
          if (roomPeers) {
            const payload = JSON.stringify({
              type: 'live-caption',
              peerId: currentPeerId,
              speakerName: String(data.speakerName || 'Speaker').slice(0, 128),
              text: String(data.text || '').slice(0, 2000),
              timestamp: Date.now(),
            });
            roomPeers.forEach((pId) => {
              const target = clients.get(pId);
              if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(payload);
              }
            });
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  const cleanup = () => {
    if (!currentPeerId) return;
    const client = clients.get(currentPeerId);
    clients.delete(currentPeerId);

    if (currentRoomId && rooms.has(currentRoomId)) {
      const roomPeers = rooms.get(currentRoomId)!;
      roomPeers.delete(currentPeerId);

      const leavePayload = JSON.stringify({
        type: 'user-left',
        peerId: currentPeerId,
        displayName: client?.displayName || 'User',
      });

      roomPeers.forEach((pId) => {
        const target = clients.get(pId);
        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(leavePayload);
        }
      });

      if (roomPeers.size === 0) {
        rooms.delete(currentRoomId);
      }
    }

    admittedSockets.delete(ws);

    if (currentRoomId && waitingLobby.has(currentRoomId)) {
      waitingLobby.get(currentRoomId)!.delete(currentPeerId);
    }

    if (client) {
      db.logAudit({
        actorId: client.userId,
        actorName: client.displayName,
        actorRole: client.role,
        action: 'USER_LEFT_ROOM',
        ip: clientIp,
        details: { roomId: currentRoomId },
      });
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

// Heartbeat ping interval
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const clientEntry = Array.from(clients.values()).find((c) => c.ws === ws);
    if (clientEntry) {
      if (!clientEntry.isAlive) {
        ws.terminate();
        return;
      }
      clientEntry.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  });
}, 25000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// 1. Health check & Diagnostics
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.6.0-enterprise-hardened',
    activeRooms: rooms.size,
    activePeers: clients.size,
    timestamp: Date.now(),
  });
});

// 2. Authentication: Login with Verified Email & Password (P0 #1, #2, #3)
app.post('/api/auth/login', (req, res) => {
  const ip = getClientIp(req);
  if (!loginRateLimiter.allow(ip)) return res.status(429).json({ error: 'Too many authentication attempts' });
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isValidPassword = verifyPassword(password, user.password_hash, user.salt);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // P0 Constraint: Role is strictly derived from verified database record!
  const token = signJwt(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      companyId: user.companyId,
      siteId: user.siteId,
    },
    8 * 3600
  );

  const now = Math.floor(Date.now() / 1000);

  db.logAudit({
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    action: 'USER_LOGIN',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1',
    details: { companyId: user.companyId },
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      companyId: user.companyId,
      siteId: user.siteId,
      token,
      exp: now + 8 * 3600,
    },
  });
});

// 3. Authentication: Register New Participant (P0 #2: Cannot self-assign Host/Admin)
app.post('/api/auth/register', (req, res) => {
  const { email, password, displayName, inviteToken, roomCode } = req.body || {};
  if (!email || !password || !displayName || !inviteToken || !roomCode) return res.status(400).json({ error: 'Email, password, displayName, inviteToken, and roomCode are required' });
  const invitation = db.checkInvitation(String(inviteToken), String(roomCode));
  if (!invitation.valid || !invitation.invitation || invitation.invitation.role !== 'participant') return res.status(403).json({ error: 'A valid participant invitation is required' });
  const inv = db.getInvitation(String(inviteToken));
  if (!inv) return res.status(403).json({ error: 'A valid participant invitation is required' });
  if (db.getUserByEmail(String(email))) return res.status(409).json({ error: 'Unable to create account with the supplied information' });
  const passwordCreds = hashPassword(String(password));
  const newUser = db.createUser({ id: `usr-${crypto.randomUUID()}`, email: String(email), password_hash: passwordCreds.hash, salt: passwordCreds.salt, displayName: String(displayName), role: 'participant', companyId: inv.companyId });
  const token = signJwt({ id: newUser.id, email: newUser.email, displayName: newUser.displayName, role: newUser.role, companyId: newUser.companyId });
  db.logAudit({ actorId: newUser.id, actorName: newUser.displayName, actorRole: newUser.role, action: 'USER_REGISTERED_BY_INVITATION', details: { roomCode } });
  res.status(201).json({ user: { id: newUser.id, email: newUser.email, displayName: newUser.displayName, role: newUser.role, companyId: newUser.companyId, token, exp: Math.floor(Date.now() / 1000) + 8 * 3600 } });
});

// 4. Token Verification
app.post('/api/auth/verify', (req, res) => {
  const token = getBearerToken(req);
  const result = token ? verifyJwt(token) : { valid: false, error: 'Authentication required' };
  if (!result.valid || !result.payload) {
    return res.status(401).json({ valid: false, error: result.error });
  }
  res.json({ valid: true, payload: result.payload });
});

// 5. Current User Info
app.get('/api/auth/me', (req, res) => { const user = requireAuth(req, res); if (!user) return; res.json({ user }); });

// 6. Invitations: Create Secure Invitation with Role Hierarchy & Company Binding (P0 #6)
app.post('/api/invitations/create', (req, res) => {
  const authPayload = requireAuth(req, res);
  if (!authPayload) return;
  const authResult = { valid: true, payload: authPayload };

  const { roomCode, role = 'participant', expiresInHours = 24, maxUses = 10 } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: 'roomCode is required' });
  }

  // P0 Constraint: Check that creator has permission to create invitations
  if (authResult.payload.role !== 'host' && authResult.payload.role !== 'co-host' && authResult.payload.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only host, co-host, or admin can generate invitations' });
  }

  // P0 Constraint: Role hierarchy check - creator cannot grant equal or higher privileges
  if (!canAssignRoleInInvitation(authResult.payload.role, role as Role)) {
    return res.status(403).json({
      error: `Forbidden: As a '${authResult.payload.role}', you cannot invite a user with role '${role}'.`,
    });
  }

  // P0 Constraint: Check room and company boundaries if room exists
  const meeting = db.getMeeting(roomCode);
  if (meeting) {
    if (meeting.companyId !== authResult.payload.companyId || (meeting.hostId !== authResult.payload.sub && authResult.payload.role !== 'admin')) {
      return res.status(403).json({
        error: 'Forbidden: Cannot create invitations for a room belonging to a different company.',
      });
    }
  }

  const inviteToken = generateSecureInviteToken();
  const invitation = db.createInvitation(
    roomCode,
    authResult.payload.companyId,
    inviteToken,
    role as Role,
    expiresInHours,
    maxUses,
    authResult.payload.sub
  );

  // P0 Constraint: Never log the inviteToken in audit logs!
  db.logAudit({
    actorId: authResult.payload.sub,
    actorName: authResult.payload.displayName,
    actorRole: authResult.payload.role,
    action: 'INVITATION_GENERATED',
    details: { roomCode, role, maxUses, expiresInHours },
  });

  res.json({ invitation });
});

// 7. Verify Invitation Token (P0 #6: Bound to roomCode, non-consuming check)
app.post('/api/invitations/verify', (req, res) => {
  const { inviteToken, roomCode } = req.body;
  if (!inviteToken) {
    return res.status(400).json({ valid: false, error: 'inviteToken is required' });
  }
  const result = db.checkInvitation(inviteToken, roomCode);
  if (!result.valid) {
    return res.status(403).json({ valid: false, error: result.reason });
  }
  res.json({ valid: true, invitation: result.invitation });
});

// 8. Revoke Invitation Token
app.post('/api/invitations/revoke', (req, res) => {
  const authPayload = requireAuth(req, res);
  if (!authPayload || (authPayload.role !== 'host' && authPayload.role !== 'admin')) return;
  const authResult = { valid: true, payload: authPayload };

  const { inviteToken } = req.body;
  const success = db.revokeInvitation(inviteToken, authResult.payload.companyId);
  if (!success) return res.status(404).json({ error: 'Invitation not found' });

  db.logAudit({
    actorId: authResult.payload.sub,
    actorName: authResult.payload.displayName,
    actorRole: authResult.payload.role,
    action: 'INVITATION_REVOKED',
    details: {},
  });

  res.json({ success: true });
});

// 9. Ephemeral TURN / STUN Credentials with Auth & Rate Limiting (P0 #7)
app.get('/api/turn-credentials', (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  if (!turnRateLimiter.allow(user.sub)) return res.status(429).json({ error: 'Rate limit exceeded for TURN relay allocation' });
  try { res.json(generateEphemeralTurnCredentials(user.sub, 86400)); } catch { res.status(503).json({ error: 'TURN service unavailable' }); }
});

// 10. Audit Logs (Protected: Admin & Host only, P0 #8)
app.get('/api/audit-logs', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.role !== 'admin' && user.role !== 'host') return res.status(403).json({ error: 'Forbidden' });

  const roomCode = typeof req.query.roomCode === 'string' ? req.query.roomCode : '';
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const limit = Math.min(Math.max(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '100', 10) || 100, 1), 100);
  if (!roomCode || !canAccessMeeting(user, roomCode)) return res.status(404).json({ error: 'Meeting not found' });
  const logs = db.getAuditLogs({ roomCode, action, limit });
  res.json({ logs });
});

// 11. Meetings List & Details
app.get('/api/meetings', (req, res) => { const user = requireAuth(req, res); if (!user) return; res.json({ meetings: db.listMeetings(user.companyId, user.sub) }); });

app.get('/api/meetings/:roomId', (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  const roomId = req.params.roomId;
  const meeting = db.getMeeting(roomId);
  if (!meeting || !canAccessMeeting(user, roomId)) return res.status(404).json({ error: 'Meeting not found' });
  const roomPeers = rooms.get(roomId);

  const activeParticipants = roomPeers
    ? Array.from(roomPeers)
        .map((pId) => clients.get(pId))
        .filter(Boolean)
        .map((c) => ({
          peerId: c!.peerId,
          displayName: c!.displayName,
          role: c!.role,
          companyId: c!.companyId,
          isMuted: c!.isMuted,
          isCameraOff: c!.isCameraOff,
          isScreenSharing: c!.isScreenSharing,
          isHandRaised: c!.isHandRaised,
        }))
    : [];

  res.json({
    exists: !!meeting,
    meeting: meeting || null,
    participantCount: activeParticipants.length,
    participants: activeParticipants,
    chatMessages: db.getChatMessages(roomId),
  });
});

// 12. HSE Integration Endpoints (Database-backed)
app.get('/api/hse/projects', (req, res) => { const user = requireAuth(req, res); if (!user) return; res.json({ projects: listHseProjects(user.companyId) }); });

app.get('/api/hse/context/:roomId', (req, res) => { const user = requireAuth(req, res); if (!user) return; const meeting = db.getMeeting(req.params.roomId); if (!meeting || !canAccessMeeting(user, req.params.roomId)) return res.status(404).json({ error: 'Meeting not found' });
  res.json({
    hseContext: meeting?.hseContext || null,
    headerMarkdown: meeting?.hseContext ? formatHseComplianceHeader(meeting.hseContext) : '',
  });
});

app.post('/api/hse/context/:roomId', (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  const meeting = db.getMeeting(req.params.roomId);
  if (!meeting || meeting.companyId !== user.companyId || (meeting.hostId !== user.sub && user.role !== 'admin')) return res.status(403).json({ error: 'Forbidden' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const allowedCategories = new Set(['toolbox', 'incident_review', 'audit_ncr', 'safety_committee', 'general']);
  const hseContext = {
    companyId: user.companyId,
    siteId: typeof body.siteId === 'string' ? body.siteId.slice(0, 128) : meeting.hseContext?.siteId,
    projectId: typeof body.projectId === 'string' ? body.projectId.slice(0, 128) : meeting.hseContext?.projectId,
    ncrNumber: typeof body.ncrNumber === 'string' ? body.ncrNumber.slice(0, 128) : meeting.hseContext?.ncrNumber,
    incidentId: typeof body.incidentId === 'string' ? body.incidentId.slice(0, 128) : meeting.hseContext?.incidentId,
    capaId: typeof body.capaId === 'string' ? body.capaId.slice(0, 128) : meeting.hseContext?.capaId,
    toolboxTopic: typeof body.toolboxTopic === 'string' ? body.toolboxTopic.slice(0, 500) : meeting.hseContext?.toolboxTopic,
    category: allowedCategories.has(body.category) ? body.category : (meeting.hseContext?.category || 'general'),
  };
  if (hseContext.projectId && !db.listProjects(user.companyId).some((project) => project.id === hseContext.projectId)) return res.status(403).json({ error: 'Project is outside the user company scope' });
  db.updateMeeting(req.params.roomId, { hseContext });
  meeting.hseContext = hseContext;
  res.json({ success: true, hseContext: meeting.hseContext });
});

// 13. Gemini AI Endpoints (Server-Side)
app.post('/api/ai/summarize', async (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  const { transcript, meetingTitle = 'Board Meeting', hseContext, roomId } = req.body || {};
  if (!roomId || !canAccessMeeting(user, String(roomId))) return res.status(404).json({ error: 'Meeting not found' });
  try {
    const summaryResult = await summarizeMeetingWithGemini(transcript || '', meetingTitle, hseContext);
    res.json(summaryResult);
  } catch (err: any) {
    res.status(502).json({ error: 'AI service unavailable' });
  }
});

app.post('/api/ai/extract-actions', async (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  const { transcript, hseContext, roomId } = req.body || {};
  if (!roomId || !canAccessMeeting(user, String(roomId))) return res.status(404).json({ error: 'Meeting not found' });
  try {
    const actionsResult = await extractActionsWithGemini(transcript || '', hseContext);
    res.json(actionsResult);
  } catch (err: any) {
    res.status(502).json({ error: 'AI service unavailable' });
  }
});

app.post('/api/ai/search-minutes', async (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  const { query, documents = [], roomId } = req.body || {};
  if (!roomId || !canAccessMeeting(user, String(roomId))) return res.status(404).json({ error: 'Meeting not found' });
  try {
    const results = await searchMinutesWithGemini(query || '', documents);
    res.json({ results });
  } catch (err: any) {
    res.status(502).json({ error: 'AI service unavailable' });
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request' });
  console.error('Unhandled request error');
  return res.status(500).json({ error: 'Internal server error' });
});

// Setup Vite dev server or static dist
async function setupApp() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) throw new Error('JWT_SECRET is required in production');
    if (!process.env.TURN_SECRET || process.env.TURN_SECRET.trim().length < 16) throw new Error('TURN_SECRET is required in production');
    if (!process.env.TURN_URLS) throw new Error('TURN_URLS is required in production');
    if (!(process.env.ALLOWED_ORIGINS || '').trim()) throw new Error('ALLOWED_ORIGINS is required in production');
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[ABDULKAREM LIVE MEETING ENTERPRISE] Server listening on http://0.0.0.0:${port}`);
  });
}

setupApp().catch((err) => {
  console.error('Failed to start enterprise server:', err);
  process.exit(1);
});
