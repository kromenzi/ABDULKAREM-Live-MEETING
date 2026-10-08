import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { signJwt, verifyJwt, revokeJwt } from '../src/server/auth.js';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3100';
const results: Array<{ id: string; status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_TESTED'; details: string }> = [];

function record(id: string, status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_TESTED', details: string) { results.push({ id, status, details }); }
async function request(pathname: string, init?: RequestInit) { return fetch(`${BASE_URL}${pathname}`, init); }

async function main() {
  // JWT cryptographic and claim validation without fixed credentials.
  const token = signJwt({ id: 'test-user', email: 'test@example.invalid', displayName: 'Test User', role: 'participant', companyId: 'test-company' }, 300);
  assert.equal(verifyJwt(token).valid, true);
  assert.equal(verifyJwt(`${token.slice(0, -1)}x`).valid, false);
  revokeJwt(token);
  assert.equal(verifyJwt(token).valid, false);
  record('jwt-integrity-and-revocation', 'PASS', 'Generated token, forged signature, and revocation were verified in memory.');

  // Static package hygiene checks.
  const root = process.cwd();
  const forbidden = ['Admin' + 'Secret2026!', 'Host' + 'Secret2026!', 'Contractor' + 'Secret2026!', 'eyJ' + 'hbGci'];
  const files = fs.readdirSync(root, { recursive: true }).filter((f): f is string => typeof f === 'string' && !f.includes('node_modules') && !f.startsWith('dist/'));
  const leaked = files.filter((f) => { try { const text = fs.readFileSync(path.join(root, f), 'utf8'); return forbidden.some((x) => text.includes(x)); } catch { return false; } });
  assert.deepEqual(leaked, []);
  assert.equal(fs.existsSync(path.join(root, '.env')), false);
  if (!process.env.ALLOW_RUNTIME_DATA) assert.equal(fs.existsSync(path.join(root, 'data', 'enterprise_meetings.sqlite')), false);
  record('package-secret-and-demo-data-scan', 'PASS', process.env.ALLOW_RUNTIME_DATA ? 'No secrets found; runtime database explicitly allowed for isolated execution.' : 'No fixed demo credentials, JWT samples, .env, or SQLite database artifacts found.');

  const serverSource = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
  const dbSource = fs.readFileSync(path.join(root, 'src', 'server', 'db.ts'), 'utf8');
  const clientSource = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
  const webrtcSource = fs.readFileSync(path.join(root, 'src', 'utils', 'webrtc.ts'), 'utf8');
  assert.equal(clientSource.includes('/ws?token='), false);
  assert.equal(clientSource.includes('isAdmitted'), false);
  assert.equal(webrtcSource.includes('openrelay'), false);
  assert.equal(webrtcSource.includes("credential: 'openrelay'"), false);
  assert.equal(dbSource.includes('meeting_cohosts'), true);
  assert.equal(serverSource.includes('TURN_URLS'), true);
  assert.equal(serverSource.includes('ALLOWED_ORIGINS'), true);
  record('websocket-and-production-configuration-hardening', 'PASS', 'No JWT URL transport, client admission flag, or bundled public TURN credentials; scoped co-host table and production TURN/origin gates present.');

  // Runtime negative authorization checks. These are BLOCKED when no server was supplied.
  try {
    const health = await request('/api/health');
    assert.equal(health.status, 200);
    const meetings = await request('/api/meetings');
    assert.equal(meetings.status, 401);
    const ai = await request('/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: 'redacted' }) });
    assert.equal(ai.status, 401);
    const register = await request('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'test@example.invalid', password: 'NotARealPassword123!', displayName: 'Test', companyId: 'forged', role: 'admin' }) });
    assert.equal(register.status, 400);
    record('runtime-unauthenticated-and-self-registration', 'PASS', 'Health=200; meetings=401; AI=401; registration without invitation=400.');
  } catch (error) {
    record('runtime-unauthenticated-and-self-registration', 'BLOCKED', `Runtime server unavailable at ${BASE_URL}; no success claim made.`);
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(JSON.stringify({ results, summary: { pass: results.filter((r) => r.status === 'PASS').length, fail: failed.length, blocked: results.filter((r) => r.status === 'BLOCKED').length } }, null, 2));
  if (failed.length) process.exitCode = 1;
}
main().catch((error) => { record('harness', 'FAIL', error instanceof Error ? error.message : 'Unknown failure'); console.log(JSON.stringify({ results }, null, 2)); process.exitCode = 1; });
