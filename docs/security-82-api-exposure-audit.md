# SECURITY-82 — Supabase API exposure

17 November 2026 · Draft PR #274 · app-development · PostgreSQL 17.11 · **NO-GO**

Production inspection used catalog SELECTs over relations, policies, effective role privileges, routine ownership, rewrite dependencies and PostgREST schema settings. No application rows were read. The SQL session and database role settings did not report `pgrst.db_schemas`. The managed Data API enablement, exposed schemas, PostgREST schema cache and GraphQL configuration remain unverified. The inventory below describes SQL reachability in `public`; API exposure is conditional on gateway configuration.

| Objects in public | anon / authenticated | Observed controls |
|---|---|---|
| `nhl_core43_shadow_inputs` | Broad direct grants including SELECT, DML, TRUNCATE and MAINTAIN | RLS enabled, no policies. RLS filters row operations but does not cover TRUNCATE. No public-role production operation was attempted. |
| `core43_shadow_{predictions,preview,readiness}_v1` | Broad direct grants | Non-updatable views. No `security_invoker`; owned by `postgres` with BYPASSRLS. Predictions and preview reference shadow inputs and archive; readiness references starter evidence, goalie snapshots and archive. The view projections can expose derived internal data despite base-table RLS. |
| `nhl_core42_status`, `nhl_core_model_{accuracy,head_to_head,trend}` | Broad direct grants | Non-updatable, owner-rights views derived from the archive. Status is in scope; the other three have verified application consumers. |
| `nhl_core43_public_schedule_evidence`, `nhl_prediction_archive` | SELECT only | Schedule view has `security_barrier=true`, runs with owner rights and projects private schedule snapshots. Archive has a SELECT RLS policy for both roles. |
| `favorite_players` | Broad grants to both roles | RLS enabled; SELECT, INSERT and DELETE policies target authenticated. Its policy expressions and application contract were outside the five-object remediation. Review excess ACL separately. |
| Remaining 16 relations | No table or column SELECT grant | Nine CORE views use `security_invoker=true`; the seven other relations are RLS-enabled tables. |

Both public roles lack BYPASSRLS. `service_role` has BYPASSRLS and SELECT on all 27 relations; it has broad DML and TRUNCATE rights on 26 in the catalog check, and SELECT/INSERT on prediction revisions. View updatability still applies. The seven enumerated ordinary public functions have effective EXECUTE for `service_role` and neither public role; three are trigger/event-trigger functions with a restricted invocation context. See SECURITY-86 for routine ownership and closure gaps.

The five scoped ACLs have direct grants from `postgres` to `anon`, `authenticated` and `service_role` without grant options, plus owner entries; no column ACLs were recorded. The effective access inventory does not establish external consumers, actual REST authorization responses or which view values are intentionally public. No production endpoint was called to test permissions.

[Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
