import { getPostgresUserProfileByAuthId, type PostgresUserProfileRecord } from './postgres-auth.js';

interface SupabaseAuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface SupabasePasswordLoginResult {
  accessToken: string;
  refreshToken?: string;
  user: SupabaseAuthUser;
  profile: PostgresUserProfileRecord;
}

function getSupabaseUrl(): string | null {
  const value = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  return value || null;
}

function getSupabaseAnonKey(): string | null {
  const value = process.env.SUPABASE_ANON_KEY?.trim();
  return value || null;
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

async function supabaseRequest<T>(path: string, init: RequestInit): Promise<T> {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) throw new Error('Supabase Auth is not configured');

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const error = new Error(`Supabase Auth request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return await response.json() as T;
}

export async function getSupabaseAuthUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  if (!accessToken || !isSupabaseAuthConfigured()) return null;
  try {
    return await supabaseRequest<SupabaseAuthUser>('/auth/v1/user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

export async function signInWithSupabasePassword(email: string, password: string): Promise<SupabasePasswordLoginResult | null> {
  if (!isSupabaseAuthConfigured()) return null;
  const result = await supabaseRequest<{ access_token?: string; refresh_token?: string; user?: SupabaseAuthUser }>(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    },
  );

  if (!result.access_token || !result.user?.id) return null;
  const profile = await getPostgresUserProfileByAuthId(result.user.id);
  if (!profile) {
    const error = new Error('Supabase user has no provisioned enterprise profile');
    (error as Error & { code?: string }).code = 'PROFILE_NOT_PROVISIONED';
    throw error;
  }

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    user: result.user,
    profile,
  };
}
