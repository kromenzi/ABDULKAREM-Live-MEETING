#!/usr/bin/env node
import pg from 'pg';

const { Pool } = pg;

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? String(process.argv[i + 1] || '') : fallback;
}

const databaseUrl = process.env.DATABASE_URL;
const authUserId = arg('auth-user-id', process.env.AUTH_USER_ID).trim();
const companyId = arg('company-id', process.env.COMPANY_ID || 'demo-company').trim();
const companyName = arg('company-name', process.env.COMPANY_NAME || 'Demo Company').trim();
const displayName = arg('name', process.env.DISPLAY_NAME || '').trim();
const role = arg('role', 'participant').trim();
const siteId = arg('site-id', process.env.SITE_ID || 'demo-site').trim();

if (!databaseUrl) throw new Error('DATABASE_URL غير موجود.');
if (!authUserId || !/^[0-9a-f-]{36}$/i.test(authUserId)) throw new Error('--auth-user-id يجب أن يكون UUID صالحًا.');
if (!companyId || companyId.length > 128) throw new Error('company-id غير صالح.');
if (!companyName || companyName.length > 255) throw new Error('company-name غير صالح.');
if (!['participant', 'host', 'co-host', 'hse_officer', 'hse_manager', 'admin'].includes(role)) throw new Error('role غير مسموح.');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000,
});
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const authResult = await client.query(
    'SELECT id, email, COALESCE(raw_user_meta_data->>\'display_name\', raw_user_meta_data->>\'full_name\') AS metadata_name FROM auth.users WHERE id = $1 LIMIT 1',
    [authUserId],
  );
  const authUser = authResult.rows[0];
  if (!authUser) throw new Error('لم يتم العثور على auth.users بهذا المعرف. أنشئ المستخدم في Supabase Auth أولًا.');
  const email = String(authUser.email || '').trim().toLowerCase();
  const resolvedName = displayName || String(authUser.metadata_name || email.split('@')[0] || 'Supabase User').slice(0, 128);

  await client.query(
    `INSERT INTO public.companies (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [companyId, companyName],
  );
  await client.query(
    `INSERT INTO public.user_profiles
       (auth_user_id, email, display_name, role, company_id, site_id)
     VALUES ($1, $2, $3, $4::user_role, $5, $6)
     ON CONFLICT (auth_user_id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role,
       company_id = EXCLUDED.company_id,
       site_id = EXCLUDED.site_id`,
    [authUserId, email, resolvedName, role, companyId, siteId],
  );
  await client.query('COMMIT');
  console.log(JSON.stringify({ ok: true, authUserId, email, companyId, role }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
