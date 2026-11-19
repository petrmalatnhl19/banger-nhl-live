# SECURITY-100 — staged public API migration gate (NO-GO)

Status: **NO-GO for production revocation**. This is a plan and an offline guard, not an approved deployment.

## Existing dependencies
- The current TV Match Stats frontend in `scripts/banger_tv_match_stats.js` requests `nhl_prediction_archive`, `core43_shadow_predictions_v1` and `core43_shadow_preview_v1`.
- SECURITY-95/96 publish only a proposed nine-field contract, not a deployed endpoint.
- SECURITY-99 proves PostgreSQL + PostgREST access against a **disposable synthetic table** named `security99_tv_public_v1`. It does **not** prove that the live application can read an equivalent replacement endpoint.
- Public grants on the internal shadow objects remain excessive. The current SQL revocation experiment is deliberately local-only.

## Release gates (all must pass, in order)
1. **Data classification:** approve each proposed public field, source, freshness policy, and game eligibility. Do not expose source identifiers, goalie evidence, operational readiness, internal statuses or raw records.
2. **Production-compatible read contract:** design a stable endpoint with a reviewed schema, read-only permissions, RLS/role isolation and explicit limits. Review the view-owner/RLS interaction and any security-definer function separately. A synthetic test table is not a deployment artifact.
3. **Parallel compatibility:** adapt the TV client to consume the reviewed endpoint behind an explicit, disabled-by-default rollout switch; preserve the current display and distinguish unavailable data from legitimate zero. Do not ship a switch enabled before the replacement is live.
4. **Isolated end-to-end regression:** test PostgREST role grants, anonymous and authenticated reads, forbidden writes, missing/duplicate games, malformed values, stale predictions, and all TV rendering states. Ensure no internal fields appear in responses.
5. **Observability:** define non-sensitive success/error counters, rollback thresholds, operator responsibility and a timeboxed canary. No raw tokens, JWTs or private source records in logs.
6. **Production preflight (read-only):** recheck exact object ACLs, RLS policies, dependencies, schema exposure, current frontend queries, service-role dependencies and restore permissions. Record a timestamped approval artifact.
7. **Change approval:** only after explicit authorization, stage the compatible replacement first. Validate real API behavior and UI before revoking old grants. Keep an independently tested restoration procedure.
8. **Post-change verification:** assert read-only public contract, denied access to internal tables/views, unaffected CORE 4.2 archive, CORE 4.3 processing, and frontend behavior. On unexpected errors, stop and restore the previously approved access state.

## Stop conditions
- No approved replacement endpoint or unknown ownership/field sensitivity.
- Any direct frontend dependency still uses the soon-to-be-revoked views.
- Any missing service-role or scheduled-job permission inventory.
- Failed role/HTTP/UI tests or unavailable rollback rehearsal.
- No explicit approval for the production window.

## Current decision
**NO-GO**: the frontend still depends on the old views and the replacement is only an isolated fixture. Do not execute `security87-revocation.sql` on production, merge PR #274, or change Supabase grants.
