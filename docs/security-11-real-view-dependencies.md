# SECURITY-11 — real production view dependencies (read-only inspection)

Scope: Supabase project `app-development` (`xxwqeiuyislnoxsmjuul`). Inspection used only `SELECT pg_get_viewdef(...)` and catalog column metadata; no schema or data mutations.

## Verified dependencies

| View | Production source tables | Exposure decision |
| --- | --- | --- |
| `core43_shadow_predictions_v1` | `nhl_core43_shadow_inputs`, `nhl_prediction_archive` | internal; deny anon/authenticated |
| `core43_shadow_preview_v1` | `nhl_core43_shadow_inputs`, `nhl_prediction_archive` | internal; deny anon/authenticated |
| `core43_shadow_readiness_v1` | `nhl_prediction_archive`, `nhl_core43_starter_evidence`, `nhl_core43_goalie_snapshots` | internal; deny anon/authenticated |
| `nhl_core42_status` | `nhl_prediction_archive` | public aggregate; retain SELECT |
| `nhl_core43_public_schedule_evidence` | `nhl_core43_schedule_snapshots` | public 4-column projection; retain SELECT |
| `nhl_core_model_accuracy` | `nhl_prediction_archive` | public aggregate; retain SELECT |
| `nhl_core_model_head_to_head` | `nhl_prediction_archive` | public aggregate; retain SELECT |
| `nhl_core_model_trend` | `nhl_prediction_archive` | public aggregate; retain SELECT |

## Material difference from SECURITY-09 fixture

The current fixture defines simplified stand-ins for all eight views. It validates SQL GRANT/REVOKE behavior, **not** that production view SQL can be recreated or that its time-bounded evidence logic is preserved.

Real `core43_shadow_readiness_v1` derives goalie IDs from `nhl_prediction_archive.core42_factors` JSON, performs two lateral joins with pre-prediction timestamp constraints, and selects the most recently verified starter evidence and goalie snapshot. Its final readiness expression depends on evidence status, shot sample size, and GSAx.

Real `core43_shadow_predictions_v1` computes per-100-shot GSAx, requires paired ready sides and CORE 4.2 values, and emits an explicitly unvalidated experimental projection. Real `core43_shadow_preview_v1` uses separate valid-GSAx and confirmed-starter conditions.

## SECURITY-11 gate before any production remediation

1. Build a **schema-only**, sanitized fixture matching all referenced columns and PostgreSQL types. Do not copy live rows, keys, credentials or personal data.
2. Recreate actual view definitions in the fixture, in dependency order; verify compilation and column signatures.
3. Use synthetic two-sided fixtures to exercise timestamp cutoffs, missing goalie ID, invalid evidence, insufficient shots, and ready cases.
4. Execute GRANT/REVOKE tests as actual `anon` and `authenticated` roles, not solely `has_table_privilege` checks. Test reads and attempted writes, and ensure public aggregates/schedule remain available.
5. Confirm frontend/edge-function/service-role consumers and account for PostgreSQL view SECURITY DEFINER behavior; do not blindly enable `security_invoker` on public views.
6. Compare test results with a **read-only** production catalog baseline. Stop on any schema drift.

No production changes, deployment, merge, migration or live-data export is authorized by this document.
