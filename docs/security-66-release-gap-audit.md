# SECURITY-66 — Evidence-based release-gap audit (SECURITY-01–65)

Date: 2026-11-17. Scope: static inspection of PR #274 changed filenames (78), branch comparison (138 commits ahead and 12 behind `main`), release-gate docs, SECURITY-42 coverage audit, SECURITY-65 integration documentation, and offline CI workflow. No production queries or changes. The prior HEAD `d4325dac01d8fd24c06b013227a4658d3764790e` had 4/4 workflows and 5/5 jobs successful; this confirms automated test execution, not release safety.

## Evidence and status

| Area | Existing evidence | Status / remaining gap |
| --- | --- | --- |
| Production grants | `docs/security-28-production-grants-release-gate.md` documents SELECT/INSERT/UPDATE/DELETE grants to `anon` and `authenticated` on CORE43 shadow inputs/views and `nhl_core42_status` | **BLOCKER**: overly broad production grants not remediated; no current production re-query in SECURITY-66 |
| Consumers and compatibility | SECURITY-21, 29–30 inventories and SECURITY-28 release gate | **BLOCKER**: external consumers and safe permission rollback/compatibility not independently established |
| Pregame evidence | SECURITY-31–35 capture analysis and refresh design | **BLOCKER**: incomplete frozen pregame starter and goalie evidence; no approved real pregame capture |
| Synthetic database resilience | SECURITY-35–44 and SECURITY-53–55, 64 | TESTED OFFLINE: SQL transactions, concurrency, crash/retry, synthetic persistence; no production-like end-to-end durability |
| Signatures and chain | SECURITY-45, 49–52, 55–63, 65 | TESTED OFFLINE: tamper, replay, signature, registry and checkpoint scenarios. Keys and anchor are local fixtures; independent trust and monotonic anchor not established |
| CORE 4.3 scoring | SECURITY-47–49, 52, 63, 65 | EXPERIMENTAL: four real `calculateShadow` variants, not calibrated full CORE 4.3 inference or accuracy validation |
| Persisted signed integration | SECURITY-65 Node test and SQLite bridge | TESTED OFFLINE: SQLite WAL/FULL atomic rollback and retry. Audit/head and archive share the same database; no independent anti-rollback durability |
| CI | `.github/workflows/security-grants-offline.yml` and separate PostgreSQL/frontend/CORE workflows | TESTED: last pre-audit HEAD 4 workflows, 5 jobs successful. Green CI cannot establish actual external data provenance or production safety |
| Operations | SECURITY-42 coverage audit | **BLOCKER**: no verified production feature gate, incident monitoring, emergency stop, rollout or production-like migration rollback |
| Accuracy | SECURITY-42 and separate PR #258 | **BLOCKER**: no prospective approved pregame accuracy pilot proving CORE 4.3 improvement |

## Priority order

**P0 / must remain NO-GO**
1. Resolve and reverify effective production grants and complete consumer dependency matrix in read-only mode; produce a migration/rollback plan but do not apply it.
2. Obtain approved real pregame source snapshots with authenticated provenance, trusted actual start/cutoff, frozen goalies and GSAx; distinguish missing data from missing permissions.
3. Define independently controlled trust root and durable external monotonic checkpoint, including key rotation/revocation and rollback recovery. Automated machine witness is acceptable; no individual reviewers are required.

**P1 / integration**
4. Replace isolated fixture-only checks with a reusable verifier wired to an approved collector and actual CORE 4.3 research pipeline; keep production writes disabled.
5. Reproduce privilege, migration, rollback and failure tests in a production-like isolated Supabase/PostgreSQL environment with RLS and view dependencies.
6. Add operational flags, monitoring, alerts, pause and restore procedures.

**P2 / release evidence**
7. Run a prospective pregame-only shadow pilot and independently compare four variants on fixed samples and calibration metrics; do not claim better accuracy without results.
8. Reconcile PR #274 against current `main` (12 commits behind at audit time), with explicit regression verification and no automatic merge.

## Explicit limitations

This is a **targeted static audit** based on inspected files, documented earlier checks and last confirmed CI. It is not a fresh complete line-by-line review of all 78 changed files, nor a live Supabase privilege scan. A separate read-only production recheck is necessary before treating the recorded grants as current. Existing synthetic tests cannot certify real-world authenticity or end-to-end production security.

**Decision: NO-GO.** Keep PR #274 Draft and unmerged. No changes to production Supabase, CORE 4.2, schedules, deployment or other PRs.
