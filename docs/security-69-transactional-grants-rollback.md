# SECURITY-69 — Isolated PostgreSQL grant transaction and rollback

Date: 2026-11-17. **Offline only**. Draft PR #274; no production Supabase changes.

## Test

`security/local/security69-transaction-rollback.sh` runs after the existing `security/local/verify.sh` against the ephemeral PostgreSQL 17 Docker Compose database with synthetic schema and data. It does not use remote credentials.

1. The existing test suite has already applied the SECURITY-06 scoped revocation in the local fixture.
2. Begin a database transaction, temporarily re-grant original public-role privileges to the five target objects, and assert the pre-revocation privilege matrix.
3. In the same transaction, apply the proposed restricted grants and assert `anon` and `authenticated` lose access to internal objects but retain SELECT on `nhl_core42_status`.
4. **ROLLBACK** the transaction, assert the previously committed restricted baseline remains unchanged, and execute actual-role queries: public status works and internal readiness view access fails.
5. Confirm SELECT access remains on schedule, analytics, and prediction archive endpoints.

The test is wired to `.github/workflows/security-local-postgres.yml` and must pass in GitHub Actions before claiming validation.

## Limitations

This demonstrates transactional rollback **to the database state before the transaction**; it is not a tested production rollback migration restoring an independently captured full grant baseline. Fixture roles and view definitions approximate selected production objects, not all production policies, external consumers, or Supabase Data API behavior. It does not prove actual production grant revocation is safe.

**NO-GO**. Do not merge, deploy, modify cron, production CORE 4.2, or Supabase permissions. Next: capture and test an exact baseline-derived rollback in isolated PostgreSQL and complete consumer compatibility checks.
