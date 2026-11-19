# SECURITY-79 — Live read-only database dependency inventory

Date: 2026-11-17. Draft PR #274. Supabase production project `app-development` (`xxwqeiuyislnoxsmjuul`). **SELECT-only metadata inspection**, no database writes.

## PostgreSQL catalog dependency query

Queried `pg_depend`, `pg_rewrite`, `pg_class` for five audited targets.

- `public.nhl_core43_shadow_inputs`: normal rewrite dependencies from `core43_shadow_predictions_v1` (5 dependency entries) and `core43_shadow_preview_v1` (8 entries). Counts are catalog dependency rows, **not consumers or queries**.
- `core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, `core43_shadow_readiness_v1`, `nhl_core42_status`: own internal `pg_rewrite` dependency entries only within the scoped target-reference query. This is **not proof of zero downstream consumers**.
- Function-body references are not reliably represented by `pg_depend` for procedural SQL; separately scanned function definitions.

## Function definitions

Read-only scan of `pg_get_functiondef` for ordinary functions (`prokind='f'`) in `public` and `cron`, matching the five identifiers, found one direct match:

- `public.capture_core43_shadow_inputs` mentions `nhl_core43_shadow_inputs` and is **SECURITY DEFINER** (`prosecdef=true`).

This search does not cover every schema, dynamic SQL constructed without literal identifiers, external Edge Functions or HTTP clients.

## Active cron metadata

Read-only query of `cron.job` returned four active jobs:

- ID 3 `banger-nhl-collect`: no literal target name or capture routine mention in stored command.
- ID 4 `banger-nhl-finalize`: same.
- ID 5 `banger-core43-shadow-capture`: stored command mentions `capture_core43_shadow_inputs`; indirect dependency on shadow inputs.
- ID 6 `banger-core43-starter-evidence`: no literal target name or capture routine mention in stored command.

These are textual command matches, not complete downstream dependency traces. No cron jobs were executed, edited or disabled.

## Release implication

Broad direct production ACL grants on the five objects remain unresolved (SECURITY-71). The SECURITY DEFINER capture function and active cron #5 need execution-role, EXECUTE privilege, search_path and API exposure checks before an isolated migration rehearsal. Existing public status and analytics consumers must remain compatible.

**Next read-only steps:** inspect `pg_proc.proacl` / `has_function_privilege`, function owner and configured `search_path`; catalog dependencies of all views on target tables; enumerate available Edge Functions and actual deployed API paths through authorized metadata. Then build isolated staging compatibility checks. Do not assume a catalog match is an active API consumer, or absence of a match proves safety.

No production SQL writes, grants changes, deployments, merge, scheduled activation or CORE 4.2 changes. **NO-GO**.
