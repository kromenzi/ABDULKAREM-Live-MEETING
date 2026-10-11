#!/usr/bin/env node
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pg from 'pg';

const { Pool } = pg;

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

function hashPassword(password) {
  if (password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function assertSafeValue(value, label, maxLength) {
  if (!value || value.length > maxLength) throw new Error(`${label} غير صالح.`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL غير موجود. استخدم اتصال Supabase Transaction Pooler.');
}

const email = (getArg('email', process.env.TEST_USER_EMAIL) || '').trim().toLowerCase();
const displayName = (getArg('name', process.env.TEST_USER_NAME) || 'Test Participant').trim();
const companyId = (getArg('company-id', process.env.TEST_COMPANY_ID) || 'demo-company').trim();
const companyName = (getArg('company-name', process.env.TEST_COMPANY_NAME) || 'Demo Company').trim();
const siteId = (getArg('site-id', process.env.TEST_SITE_ID) || 'demo-site').trim();
const userId = (getArg('user-id', process.env.TEST_USER_ID) || `test-${crypto.randomUUID()}`).trim();
const role = (getArg('role', 'participant') || 'participant').trim();
let password = process.env.TEST_USER_PASSWORD || '';

assertSafeValue(email, 'البريد الإلكتروني', 255);
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('البريد الإلكتروني غير صالح.');
assertSafeValue(displayName, 'اسم المستخدم', 128);
assertSafeValue(companyId, 'معرف الشركة', 128);
assertSafeValue(companyName, 'اسم الشركة', 255);
assertSafeValue(siteId, 'معرف الموقع', 128);
assertSafeValue(userId, 'معرف المستخدم', 128);
if (!['participant', 'host', 'co-host', 'hse_officer', 'hse_manager', 'admin'].includes(role)) {
  throw new Error('الدور غير مسموح.');
}

let rl;
try {
  if (!password) {
    rl = readline.createInterface({ input, output });
    rl.stdoutMuted = true;
    rl._writeToOutput = (text) => output.write(rl.stdoutMuted ? '*'.repeat(text.replace(/\r?\n/g, '').length) : text);
    password = await rl.question('كلمة مرور المستخدم التجريبي: ');
    output.write('\n');
  }
  const { hash, salt } = hashPassword(password);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO public.companies (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [companyId, companyName],
    );

    await client.query(
      `INSERT INTO public.users
         (id, email, password_hash, salt, display_name, role, company_id, site_id)
       VALUES ($1, $2, $3, $4, $5, $6::user_role, $7, $8)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         salt = EXCLUDED.salt,
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         company_id = EXCLUDED.company_id,
         site_id = EXCLUDED.site_id`,
      [userId, email, hash, salt, displayName, role, companyId, siteId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify({ ok: true, email, userId, companyId, role }, null, 2));
} finally {
  rl?.close();
}
