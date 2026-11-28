# SECURITY-129 — CI enforcement for offline provenance and replay checks

**Production decision: NO-GO.** This change connects the existing SECURITY-125 through SECURITY-128 synthetic regression suites to the existing `security-grants-offline.yml` GitHub Actions job.

## Scope
- Run timestamp provenance policy tests (SECURITY-125).
- Run synthetic Ed25519 signed public snapshot integrity tests (SECURITY-126).
- Run in-memory replay and key allowlist/revocation policy tests (SECURITY-127).
- Run disposable single-host filesystem ledger restart, contention and corruption tests (SECURITY-128).
- Keep existing offline test commands and their permission boundary unchanged (`contents: read`).

## Evidence and limitations
Passing CI demonstrates that these checked-in offline regression scripts pass on the runner. It **does not** authenticate a production issuer, establish trusted historical pre-game timestamps, provide durable multi-node replay prevention, validate Supabase role permissions, or approve a deployment. Synthetic signing keys and disposable ledger state remain test-only. No production SQL, keys, secrets, migrations, frontend or CORE changes are introduced.

## Next gate
SECURITY-130 should design and test a disposable transactional database model with per-feed/game signed issuance sequence and atomic compare-and-set, including concurrent worker tests and crash recovery, without using production Supabase.

Keep PR #274 Draft; do not merge, deploy or change production. Review the latest CI run before treating SECURITY-129 as validated.
