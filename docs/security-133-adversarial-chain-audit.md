# SECURITY-133 — Adversarial signed replay chain (offline)

**Production: NO-GO.** Adds `.github/scripts/test-security-133-adversarial-chain.cjs` to the existing offline security workflow. Uses ephemeral synthetic Ed25519 keys and a disposable SQLite database.

The regression verifies fail-closed behavior for tampered public snapshot data, changed issuance digest, sequence, scope, audience and expiry, wrong snapshot or envelope signer, inactive/revoked keys, expired evidence, duplicate replay, reuse of an accepted digest with a newer signed sequence and rollback to an old sequence. Every rejected request is checked against the persisted accepted-record count to ensure it did not add a record. One valid request is accepted to establish a baseline.

Limitations: these are deterministic fixtures, not fuzzing or formal verification. Count equality is not a complete database-state integrity proof. The SECURITY-130 SQLite worker still uses a synthetic `verified=True` flag and is not an authenticated production boundary. The tests do not establish independent trusted timestamps, signer authority, multi-node consensus or production release approval. No Supabase connections, writes, migrations, frontend or CORE 4.2 changes. PR #274 stays Draft; do not merge or deploy.
