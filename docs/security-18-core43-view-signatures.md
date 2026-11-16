# SECURITY-18 — CORE43 view signature audit (read-only)

Production source: Supabase project `app-development`, `pg_class` / `pg_attribute` / `format_type` SELECT only. No rows, credentials, or production writes.

| View | Production column count | Notable column types | Fixture status |
| --- | ---: | --- | --- |
| `core43_shadow_predictions_v1` | 15 | `game_id bigint`, `ready_sides bigint`, `core43_away numeric`, `experiment_status text` | Approximate SQL; exact definition not established |
| `core43_shadow_preview_v1` | 12 | `core42_predicted_at timestamptz`, `confirmed_sides bigint`, `core43_preview_away numeric` | Approximate SQL; exact definition not established |
| `core43_shadow_readiness_v1` | 14 | `prediction_at timestamptz`, `gsax numeric(12,4)`, `shots_against integer`, `readiness text` | Approximate SQL; fixture uses unconstrained `numeric` for snapshot GSAx; column signature may differ |

Production column order is as follows:

- Predictions: `game_id, game_date, away_team, home_team, status, core42_away, core42_home, away_gsax_per100, home_gsax_per100, ready_sides, total_sides, core43_away, core43_home, experiment_status, model_version`.
- Preview: `game_id, game_date, away_team, home_team, core42_predicted_at, away_gsax_per100, home_gsax_per100, confirmed_sides, core43_preview_away, core43_preview_home, preview_status, version`.
- Readiness: `game_id, game_date, side, team_code, goalie_name, goalie_id, prediction_at, evidence_status, source_published_at, verified_at, gsax, shots_against, gsax_fetched_at, readiness`.

## Release gate

Do not treat matching column names as proof of equivalent SQL behavior. Retrieve exact definitions, dependencies and source column types, recreate them in isolated PostgreSQL, then test permissions and all consumers. Maintain SECURITY-17 NO-GO until verified. The local schedule view `security_barrier=true` mismatch was corrected in commit `90043b6`, with a verification test in `4515d31`.
