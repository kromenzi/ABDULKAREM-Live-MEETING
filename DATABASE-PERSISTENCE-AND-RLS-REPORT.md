# Database Persistence and RLS Report

## SQLite
- Local SQLite schema remains supported.
- Production startup no longer seeds default companies, users, passwords, or meetings.
- Database artifacts are excluded from the deliverable.
- Persistence after a restart was not executed in the final clean package because doing so would create local runtime data; status **NOT_TESTED**.

## PostgreSQL
- Added `src/server/postgres.ts` with connection pooling, health check, parameterized queries and transaction rollback.
- Added company-scoped RLS policies and FORCE RLS in the migration.
- No isolated PostgreSQL server was available; status **POSTGRESQL_NOT_VERIFIED**. No Supabase Production data was accessed or changed.
