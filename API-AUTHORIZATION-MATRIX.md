# API Authorization Matrix

| Surface | Auth | Object/tenant rule | Verified result |
|---|---|---|---|
| `/api/health` | Public | Diagnostics only; no secrets | PASS: HTTP 200 |
| `/api/auth/login` | Public + rate limit | DB-derived identity; generic credential error | IMPLEMENTED; credential flow not fully E2E tested |
| `/api/auth/register` | Public request | Valid room-bound participant invitation required; company derived from invitation | PASS: no invitation rejected (400) |
| `/api/auth/me` | Bearer | JWT claims revalidated against DB user | IMPLEMENTED |
| `/api/meetings` | Bearer | Company-scoped list | PASS: no bearer rejected (401) |
| `/api/meetings/:roomId` | Bearer | Company/object access; outside scope returns 404 | IMPLEMENTED; cross-tenant data fixture not executed |
| `/api/invitations/create` | Bearer | Host/admin role and same-company meeting; role hierarchy | IMPLEMENTED |
| `/api/invitations/verify` | Public validation | Room binding, expiry, revocation, usage | IMPLEMENTED |
| `/api/turn-credentials` | Bearer + rate limit | User-derived credentials | IMPLEMENTED; TURN relay not verified |
| `/api/audit-logs` | Bearer admin/host | Sanitized logs; company filtering remains a database-policy concern | IMPLEMENTED with gap |
| `/api/hse/*` | Bearer | Same-company authorized meeting/context | IMPLEMENTED |
| `/api/ai/*` | Bearer | Authorized `roomId` required | PASS: unauthenticated AI rejected (401) |
| `/ws` | Origin + `auth-token` message | No query JWT; room-bound signaling/control | IMPLEMENTED; browser media test not run |


## Second-round controls

- Waiting-room admit/deny requires the current room context; client `isAdmitted` is not trusted.
- Co-host moderation requires a row in `meeting_cohosts` for the target meeting.
- Audit logs require a scoped `roomCode`; unscoped host/admin log enumeration is rejected.
- HSE context writes whitelist fields and verify project company scope.
