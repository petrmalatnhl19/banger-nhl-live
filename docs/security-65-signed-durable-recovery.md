# SECURITY-65 — Signed archive plus durable crash recovery (offline)

This synthetic integration test combines the signed experimental four-variant CORE 4.3 archive, root-signed local key registry, signed machine checkpoint chain and SQLite WAL/FULL persistence. Node verifies Ed25519 signatures and recomputes experimental `calculateShadow` variants. A Python subprocess performs transactional SQLite writes, simulates a process crash before COMMIT, and supports reopening, retrying, duplicate rejection and tampering.

The test requires the previously committed two-checkpoint chain to survive a crash while the uncommitted third checkpoint is rolled back; after a clean retry the third signed checkpoint must validate, and archive tampering must fail.

**Limitations:** The SQLite audit/head record is in the same database as the archive, not an independent trusted monotonic anchor. The registry and keys are synthetic and local. This does not validate real Supabase data, production archive durability, actual third-party publisher trust, disk-loss recovery, or deployment. No production changes, merges or scheduled activation. Draft PR #274 remains **NO-GO**.
