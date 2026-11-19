# SECURITY-42 — independent coverage audit SECURITY-35 to SECURITY-41

Date: 2026-11-16. Scope: static review of committed test source and previously confirmed CI on commit `f09c8a4f5226c14e514b81c1d7e01a1913bd6ad1`. No production queries, database writes, merge, deployment or workflow activation.

## Coverage matrix

| Stage | What test actually establishes | What it does NOT establish |
| --- | --- | --- |
| 35 | Eight SQLite unit scenarios for eligible evidence, immutable original *by observation*, idempotent retries, time checks | Real CORE model scoring, PostgreSQL behavior, trusted actual puck drop, persistence after crashes |
| 36 | Synthetic PostgreSQL transaction with unique key, check constraints, mutation triggers and role privilege assertions, followed by rollback | Production schema, full role/RLS behavior, concurrent race conditions, immutable external evidence provenance |
| 37 | Twelve independent PostgreSQL sessions inserting the same key with `ON CONFLICT DO NOTHING`; one row persists | Conflicting payloads for the same key, lock contention metrics, transactional end-to-end prediction creation |
| 38 | One transaction fails and rolls back while another attempts the same key | Randomized failures, application process restart, multi-step prediction atomicity |
| 39 | Uncommitted psql input closes without COMMIT; duplicate retry after successful commit is ignored | Real network interruption after COMMIT; the “lost acknowledgement” case discards stdout but does not cut the network |
| 40 | PostgreSQL backend terminated before COMMIT; aborted transaction and idempotent retry | Server crash, client-side retry policy, partial failure across external systems |
| 41 | Local PostgreSQL Compose service is restarted during a transaction; committed data survives and pending write is absent | Sudden power loss or storage failure; Compose restart is a managed restart, not a power-cut test |

All seven stages use synthetic data and no production write operations. CI reports green for three workflows and four jobs on `f09c8a4`. A green job does not prove every conceivable edge case.

## Critical release gaps (NO-GO)

1. **Trusted time and game state**: verify actual puck-drop vs scheduled start, delays/postponements, timezone normalization and cutoff clock skew. Never label a post-start refresh “pregame”.
2. **Evidence provenance**: independently record source publication, verification and ingestion timestamps; prevent later corrections from rewriting historical evidence.
3. **Immutable signed snapshot**: independently sign or attest `input_cutoff_at`, source IDs, model version, input hash and prediction output *before outcomes are known*. Test tamper detection.
4. **Real CORE integration**: no test here runs production CORE 4.3 scoring or measures whether refreshed goalie information changes calibrated predictions.
5. **Data/permission review**: design uses test-only tables. Verify proposed schema, RLS, function search_path, least-privilege grants, API consumers, rollback and migrations in a production-like isolated database.
6. **Resilience edge cases**: true network cut and ambiguous acknowledgement, process crash during multi-table transaction, server hard crash, conflicting same-key payload, deadlock/timeout and retry exhaustion.
7. **Operational controls**: disabled-by-default feature flag, scheduler rate limits, audit metrics, alerts, pause/rollback, separation from CORE 4.2, approval and explicit release gate.
8. **Accuracy pilot**: prospective pregame-only snapshots, same-game comparisons, sample size and calibration metrics; never claim an accuracy increase from infrastructure tests.

## Prioritized next work

- SECURITY-43: negative/adversarial timestamp and source provenance tests in isolated PostgreSQL.
- SECURITY-44: conflicting-payload concurrency, lock timeout and retry exhaustion tests.
- SECURITY-45: immutable snapshot hash/signature and source-to-prediction chain validation.
- SECURITY-46: isolated integration with actual CORE 4.3 scoring and schedule/status source.
- Later: production-like permissions and rollback audit; only then consider a separately authorized pilot.

## Decision

**PRODUCTION NO-GO.** Keep Draft PR #274 open and unmerged. No production Supabase grants, cron, CORE 4.2, frontend or schedule changes. This audit is a documented coverage assessment, not a certification of production readiness.
