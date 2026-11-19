# SECURITY-135 — Offline backup rollback detection

**Production decision: NO-GO.** Adds `.github/scripts/test-security-135-backup-rollback.py` to the offline security CI workflow.

Synthetic scenario: commit issuance 1; copy the SQLite database as an older backup; commit issuance 2; capture an **independently retained** canonical checkpoint (digest of accepted rows and scope heads). Compare both current and older restored databases against that checkpoint. The older backup fails closed before any replay worker is called; rejected restore must not mutate the database. Also tests new issuance 3, stale checkpoints, a mismatched checkpoint digest, corrupted SQLite and repeat issuance rejection.

**Critical limitations:** This is an offline *detector*, not a production restore mechanism. The checkpoint is an in-memory synthetic fixture, not signed, append-only, replicated, independently timestamped, or protected against attacker replacement. An attacker who rolls back both database and checkpoint defeats this fixture. The strict digest comparison also rejects legitimate new state until a trusted checkpoint update occurs; no atomic checkpoint publication protocol is implemented. A real deployment must define crash-safe, authenticated and independent checkpoint persistence, backup consistency, restore authorization and a fail-closed write gate. The SECURITY-130 worker still accepts a synthetic verified flag and must not be exposed to untrusted callers.

No Supabase access or writes, no production or CORE 4.2 changes, no merge or deployment. Keep PR #274 Draft.
