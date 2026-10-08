# Tenant Isolation Test Report

## Implemented controls
- JWT company and role claims are compared with the current database user.
- Meeting list is scoped by authenticated company.
- Meeting details, HSE context and AI calls require an authorized room in the same company.
- Registration derives company from an invitation and does not accept client `companyId`.
- Invitation consumption is atomic and checks room, expiry, revocation and usage count.
- PostgreSQL migration contains company-scoped RLS policies.

## Executed evidence
- Unauthenticated meetings request: **PASS / 401**.
- Forged registration payload without invitation: **PASS / 400**.
- Static scan for demo secrets and database artifacts: **PASS**.

## Not verified
A two-company/two-site/two-project live fixture with positive and negative reads/writes was not executed. PostgreSQL RLS was not run because no isolated PostgreSQL instance was provided. Status: **BLOCKED — POSTGRESQL_NOT_VERIFIED**.
