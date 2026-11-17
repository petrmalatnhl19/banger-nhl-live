# SECURITY-68 — Consumer compatibility and scoped privilege preflight

Date: 2026-11-17. **NO-GO**. Read-only/static work, Draft PR #274 only. No production DDL, grant revocation, cron change, CORE 4.2 change, deployment or merge.

## Verified vs unknown consumers

| Object | Known direct database dependency | Public frontend / external compatibility | Proposed treatment |
| --- | --- | --- | --- |
| `nhl_core43_shadow_inputs` | `capture_core43_shadow_inputs` SECURITY DEFINER routine and three CORE43 internal views (SECURITY-29 and SECURITY-67) | Exact frontend literal scan previously found no references; indirect consumers unknown | Remove public grants only after role/collector verification |
| `core43_shadow_readiness_v1` | Reads frozen archive and starter/goalie snapshot tables | Indirect API, Edge, mobile, external clients not exhaustively inventoried | Candidate revoke public ALL; stage and test |
| `core43_shadow_predictions_v1` | Reads shadow inputs and prediction archive | Same unknowns | Candidate revoke public ALL; stage and test |
| `core43_shadow_preview_v1` | Reads shadow inputs and prediction archive | Same unknowns | Candidate revoke public ALL; stage and test |
| `nhl_core42_status` | Reads prediction archive | Public aggregate status may be consumed | Preserve public SELECT; remove unnecessary public DML only |
| `nhl_prediction_archive` | CORE43 views read archive | Public SELECT confirmed, DML absent for anon/auth | Leave unchanged |
| Public schedule/accuracy views | Previously identified public API paths | Actual consumer compatibility still unverified | Leave unchanged |

SECURITY-29 found active cron paths for collection, finalization, shadow capture and starter evidence. They require role/context and indirect dependency checks before permission changes. This matrix is **partial**, not a full recursive repository inventory or external consumer scan.

## Offline automated preflight

`.github/scripts/test-security-68-grants-plan.py` statically checks the existing SECURITY-06 SQL proposal for the expected scoped revocations and guards against accidentally including protected public endpoints in executable REVOKE statements. It runs in `.github/workflows/security-grants-offline.yml`.

**This is a static textual guard, not a SQL parser, a staging permission test, or a proof of reversible migration.** No rollback migration is executed or certified. The existing proposal is not authorized for production.

## Explicit next release gates

1. Obtain complete branch-tree source scan, Edge Function/cron/runtime and external client inventory, including indirect REST/RPC access.
2. Capture exact role privileges and ownership, and produce a role-specific *tested* rollback script using a production-like isolated database; do not assume `GRANT ALL` is safe.
3. Run public API compatibility smoke checks before and after proposed revocations in isolated staging.
4. Keep production **NO-GO** until the above are independently verified and an explicit release authorization is given.
