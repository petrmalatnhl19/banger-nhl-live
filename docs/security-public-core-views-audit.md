# SECURITY – public CORE views: minimal integration gate

Status: **audit-only Draft PR**. No migrations, RLS changes, grants, model calculations, or production writes.

## Verified against Supabase app-development, 2026-11-22

All eight views below are owned by `postgres`, are currently selectable by `anon` and `authenticated`, and lack `security_invoker=true`.

| Views | Frontend usage on default branch | Underlying tables |
| --- | --- | --- |
| `nhl_core_model_accuracy`, `nhl_core_model_head_to_head`, `nhl_core_model_trend`, `nhl_core42_status` | `core-performance.js` | `nhl_prediction_archive` |
| `core43_shadow_predictions_v1`, `core43_shadow_preview_v1` | `scripts/banger_tv_match_stats.js` | `nhl_core43_shadow_inputs`, `nhl_prediction_archive` |
| `nhl_core43_public_schedule_evidence` | `core-performance.js`, `scripts/core43_verified_dashboard.js` | `nhl_core43_schedule_snapshots` |
| `core43_shadow_readiness_v1` | No direct default-branch code reference found by exact-name search; absence not proven | `nhl_core43_starter_evidence`, `nhl_core43_goalie_snapshots`, `nhl_prediction_archive` |

Observed base-table access:
- `nhl_prediction_archive`: RLS enabled, one policy, `anon`/`authenticated` SELECT granted.
- `nhl_core43_shadow_inputs`: RLS enabled, no policies, `anon`/`authenticated` SELECT granted.
- `nhl_core43_schedule_snapshots`, `nhl_core43_starter_evidence`, `nhl_core43_goalie_snapshots`: RLS enabled, no policies, `anon`/`authenticated` SELECT **not** granted.

**Do not bulk-set `security_invoker=true`**: some views depend on base tables unavailable to the caller. This can break TV statistics, CORE dashboards and schedule evidence. The existing schedule evidence view intentionally exposes only game ID, kickoff time and teams, with `security_barrier=true` (see `scripts/sql/core43_public_schedule_evidence.sql`).

## Required gates before a remediation PR

1. Confirm exact columns and data classification for each view; the shadow readiness view includes goalie identity and evidence timing, so do not assume all fields are safe to expose.
2. Trace all REST and RPC consumers, including scheduled jobs and code outside the default branch. Confirm whether `net` or external services depend on these views.
3. Determine whether current output is intended to be public; for non-public views, test revoking `SELECT` from `anon`/`authenticated` in an isolated environment, with frontend regression tests.
4. For public views, preserve their minimal public contract; test a replacement view or authorized API that does not grant unrestricted base-table access.
5. Capture baseline API response shapes, status codes and row counts, test authenticated and unauthenticated clients, then run the CORE dashboard, TV and schedule smoke suites.
6. Prepare rollback SQL reflecting exact pre-change ACLs. Only then request separate approval for production migration.

## Reproduce

Run `scripts/sql/security_public_core_views_audit.sql` as a read-only check. Never execute an unreviewed `REVOKE`, `GRANT`, `ALTER VIEW`, or `CREATE OR REPLACE VIEW` in production as part of this PR.

## Explicitly out of scope

No changes to CORE 4.2/4.3 calculations, prediction archives, Supabase production configuration, original Draft PR #274, or unrelated PRs.
