import { Pool } from 'pg';
import type { Role } from '../types.js';

export interface PostgresUserRecord {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  displayName: string;
  role: Role;
  companyId: string;
  siteId?: string;
  createdAt: number;
}

export interface PostgresUserProfileRecord {
  authUserId: string;
  email: string;
  displayName: string;
  role: Role;
  companyId: string;
  siteId?: string;
}

let pool: Pool | null = null;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 5),
      // Hosted Supabase PostgreSQL requires TLS; never downgrade production.
      ssl: isProduction || process.env.PGSSL !== 'disable' ? { rejectUnauthorized: false } : undefined,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

function mapUser(row: any): PostgresUserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    password_hash: String(row.password_hash),
    salt: String(row.salt),
    displayName: String(row.display_name),
    role: row.role as Role,
    companyId: String(row.company_id),
    siteId: row.site_id ? String(row.site_id) : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export async function getPostgresUserByEmail(email: string): Promise<PostgresUserRecord | null> {
  const activePool = getPool();
  if (!activePool) return null;
  const result = await activePool.query(
    'SELECT id, email, password_hash, salt, display_name, role, company_id, site_id, created_at FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [email.trim()],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export function getPostgresAuthDiagnostics(): { configured: boolean; host?: string; port?: string; database?: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { configured: false };
  try {
    const url = new URL(raw);
    return { configured: true, host: url.hostname, port: url.port || '5432', database: url.pathname.slice(1) || 'postgres' };
  } catch {
    return { configured: true };
  }
}

export async function getPostgresUserById(id: string): Promise<PostgresUserRecord | null> {
  const activePool = getPool();
  if (!activePool) return null;
  const result = await activePool.query(
    'SELECT id, email, password_hash, salt, display_name, role, company_id, site_id, created_at FROM users WHERE id = $1 LIMIT 1',
    [id],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function getPostgresUserProfileByAuthId(authUserId: string): Promise<PostgresUserProfileRecord | null> {
  const activePool = getPool();
  if (!activePool) return null;
  const result = await activePool.query(
    `SELECT auth_user_id, email, display_name, role, company_id, site_id
       FROM public.user_profiles
      WHERE auth_user_id = $1
      LIMIT 1`,
    [authUserId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    authUserId: String(row.auth_user_id),
    email: String(row.email),
    displayName: String(row.display_name),
    role: row.role as Role,
    companyId: String(row.company_id),
    siteId: row.site_id ? String(row.site_id) : undefined,
  };
}

export async function closePostgresAuthPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
