# Security Findings and Fixes

## Scope
مراجعة مشروع ABDULKAREM LIVE MEETING المرفق وتنفيذ إصلاحات مباشرة على نسخة العمل، دون استخدام بيئة إنتاجية.

## Findings fixed
- **P0 — secrets/data in archive:** removed `.env`, SQLite, WAL/SHM, and demo credentials from the deliverable; added ignore rules.
- **P0 — self-registration trust:** registration now requires a valid, room-bound participant invitation and derives `companyId` server-side.
- **P0 — JWT:** strict signature, issuer, audience, expiry, required claims, database-user revalidation, and in-memory revocation checks.
- **P0 — REST authorization:** centralized bearer authentication; meetings, HSE, AI, TURN, audit and account routes are protected; meeting details return 404 outside scope.
- **P0 — WebSocket:** JWT query-string extraction removed; authentication is via `auth-token` message; Origin is checked; signaling targets are restricted to the current room.
- **P0 — operational hardening:** login/TURN/WebSocket rate limits, security headers, CORS allowlist behavior, bounded JSON payloads, and non-sensitive error responses.
- **P1 — database:** production seed is disabled; PostgreSQL adapter and hardened RLS migration were added, but no isolated PostgreSQL server was available for execution.
- **P1 — AI:** Gemini key remains server-only; model is configurable; result source is explicit (`GEMINI_API`/`FALLBACK`); AI requests require an authorized meeting.

## Evidence
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test` without a running server: 2 PASS, 1 BLOCKED (runtime unavailable); no FAIL.
- Runtime curls from the running build: health `200`; unauthenticated meetings `401`; unauthenticated AI `401`; registration without invitation `400`.

## Residual risk
Real multi-tenant positive/negative API tests, PostgreSQL/RLS execution, real media relay, and external HSE/Gemini connectivity remain unverified. Release status: **NOT READY**.

## Second audit round

Additional defects found and fixed:
- **WebSocket client regression:** the frontend still sent JWTs in query strings and join messages; it now sends a one-time `auth-token` message and joins without credentials in URLs/payloads.
- **Waiting-room bypass:** client-controlled `isAdmitted` was removed; admission is now tracked by the server-side WebSocket object.
- **Co-host scope:** added `meeting_cohosts`; a global `co-host` role no longer grants moderation of unrelated meetings.
- **Room-context IDOR:** admit/deny commands must use the currently joined room.
- **HSE context tampering:** only an allowlisted context is accepted; company and project scope are derived/checked server-side.
- **Audit-log overexposure:** audit retrieval now requires a scoped meeting room and filters by room.
- **Production configuration:** production refuses to start without JWT/TURN secrets, TURN URLs and an explicit Origin allowlist; public OpenRelay defaults were removed.
- **Input/DoS hardening:** identifier, display-name, caption, chat, JSON parsing, rate-limit cleanup and proxy-IP handling were tightened.

Second-round runtime evidence: Health `200`, unauthenticated meetings `401`, malformed JSON `400`, disallowed Origin `403`, and forged join token rejected with an `auth-token` error.

- **Public TURN credential leak:** removed bundled OpenRelay username/password from the browser; authenticated users now fetch ephemeral TURN credentials, while unauthenticated invite guests receive STUN-only fallback.
