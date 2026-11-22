# Public CORE reporting views — minimal ACL deployment gate

**Status: Draft proposal, not applied to Supabase.** This PR does not change frontend, RLS, view definitions, model calculations, or production.

## Verified baseline (2026-11-22)

Six views: `core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, `nhl_core42_status`, `nhl_core_model_accuracy`, `nhl_core_model_head_to_head`, `nhl_core_model_trend`.

All six have public SELECT plus unnecessary public INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES grants. All six report `pg_relation_is_updatable(..., false)=0`; this does not establish that all write paths are impossible (e.g. rules/triggers). `nhl_core43_public_schedule_evidence` already has restricted writes and is excluded.

The TV frontend (`scripts/banger_tv_match_stats.js`) reads both CORE 4.3 shadow views with a publishable key. The CORE dashboard reads the other public reporting views. **Preserve public SELECT**; do not enable `security_invoker` wholesale.

## Before any production deployment

1. Review the complete six-view list and all dependent consumers, including external clients and scheduled jobs. Confirm no authorized public write contract exists.
2. Check the exact baseline ACL for each role (including PUBLIC and role inheritance), and preserve service_role access.
3. Run existing frontend smoke and security tests on the PR; record REST HTTP 200 and response shape for each public endpoint before and after migration.
4. Obtain **separate explicit approval** for production SQL. Merging a proposal PR does not deploy SQL.
5. Execute only the six REVOKEs (not the SELECT verification query as a migration); then run the included read-only verification query. Confirm no write privileges for anon/authenticated and SELECT retained.
6. Rollback only after incident review, and only restore **exact verified pre-change grants**, never blindly GRANT ALL. For baseline direct grants, query `information_schema.role_table_grants` or `aclexplode(relacl)` before execution. Re-run REST and frontend tests.

## Risks and exclusions

- No change to public visibility of experimental CORE 4.3 predictions; deciding whether those should be publicly exposed is a separate product/security decision.
- No production writes, no base-table ACL/RLS changes, no CORE 4.2/4.3 changes, and no merge of legacy PR #274.
