# SECURITY-130 — Disposable SQLite transactional replay prototype

**Production status: NO-GO.** This stage adds a standard-library Python/SQLite offline test in `.github/scripts/test-security-130-sqlite-replay.py`, executed by `security-grants-offline.yml`. It creates a disposable database under the runner temporary directory and deletes it after testing. No production database or Supabase connection is used.

## Guarantees tested
- `BEGIN IMMEDIATE` serializes local database writers; unique `(scope,seq)` and `(scope,digest)` constraints prevent duplicate issuance.
- Each `scope` has an independently increasing sequence recorded transactionally with the accepted digest.
- Replay and non-increasing sequence fail closed, including after reopening the database.
- Eight separate OS processes race to accept the same scoped issuance; exactly one may succeed.
- Uncommitted changes are rolled back after closing a connection; `PRAGMA integrity_check` is checked.
- Missing upstream verification, malformed digests and invalid sequences are rejected.

## Explicit limitations
The `verified=True` input is **synthetic test fixture state**, not evidence of a valid Ed25519 signature. This prototype does not sign issuance IDs, enforce expiry/audience, establish a trusted clock, or bind the digest to a production identity. SQLite is not a distributed transaction service. A real deployment requires a separately reviewed signature gate, trusted signer and key rotation/revocation, durable centralized storage, scoped issuer identifiers, disaster recovery, monitoring and multi-node concurrency tests. This test must not be connected to live Supabase.

No SQL migrations, secrets, production CORE 4.2 logic, frontend, public grants or deployed services were changed. PR #274 remains Draft. Do not merge or deploy.

## Next
SECURITY-131: independently validate signed scope/sequence/audience/expiry envelopes and adversarial rollback/rotation cases, offline only, then review release gates.
