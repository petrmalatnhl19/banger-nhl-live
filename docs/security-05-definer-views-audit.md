# SECURITY-05 — SECURITY DEFINER view exposure audit

**Date:** 2026-11-16. Read-only production catalog inspection. **No production changes.** Draft PR #274.

All eight views below are owned by `postgres`, have no `security_invoker=true` option, and currently grant SELECT to both `anon` and `authenticated`. A SECURITY DEFINER view can expose data from RLS-protected tables through the view owner's privileges. This is a review finding, not evidence of a breach.

| View | Source tables | Exposed fields / concern | Recommendation |
|---|---|---|---|
| `core43_shadow_predictions_v1` | `nhl_core43_shadow_inputs`, `nhl_prediction_archive` | Experimental scores, GSAx rates, readiness counts | High priority: confirm whether experimental predictions are intended public |
| `core43_shadow_preview_v1` | same | GSAx rates, provisional predictions, goalie confirmation count | High priority: confirm public exposure |
| `core43_shadow_readiness_v1` | `nhl_core43_goalie_snapshots`, `nhl_core43_starter_evidence`, `nhl_prediction_archive` | Goalie IDs/names, evidence status and timestamps, GSAx | **Highest review priority**: internal evidence metadata publicly queryable through view |
| `nhl_core43_public_schedule_evidence` | `nhl_core43_schedule_snapshots` | game ID, kickoff, teams only | Narrow intended public view; review SECURITY DEFINER design without breaking availability |
| `nhl_core42_status` | `nhl_prediction_archive` | aggregate pending/final/review counts | Likely suitable public aggregate; verify consumer expectations |
| `nhl_core_model_accuracy` | `nhl_prediction_archive` | aggregate accuracy metrics | Verify public intended use |
| `nhl_core_model_head_to_head` | `nhl_prediction_archive` | aggregate comparison metrics | Verify public intended use |
| `nhl_core_model_trend` | `nhl_prediction_archive` | game IDs, dates, rolling metrics | Verify public intended use and row-level granularity |

## Recommendations before any migration

1. Inventory frontend and API consumers of each view (GitHub code search returned no matches for a subset; **not conclusive**).
2. Decide whether the three CORE 4.3 experiment views should be publicly readable at all. Prefer revoking public SELECT from internal-only views after compatibility tests.
3. Do not indiscriminately set `security_invoker=true`: underlying private tables may become inaccessible and public endpoints may break.
4. For intentionally public views, consider carefully scoped public projections, explicit RLS policies, and security-invoker alternatives in an isolated test environment.
5. Retain `nhl_core43_public_schedule_evidence` as a narrow four-column public interface until an equivalent verified solution exists.
6. Do not run write probes or alter production RLS/GRANTs during this audit.

## Verification

- Compare pg_class reloptions and view owner before/after.
- Compare `has_table_privilege` for anon/authenticated.
- Inspect view output columns and dependencies.
- Run real anon/authenticated API read checks with non-sensitive fixtures in a controlled environment.
- Confirm production CORE 4.2, predictions and frontend are unaffected.
