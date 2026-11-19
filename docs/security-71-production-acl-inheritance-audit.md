# SECURITY-71 — Production ACL and role inheritance audit (read-only)

Date: 2026-11-17. Supabase `app-development`, project `xxwqeiuyislnoxsmjuul`. **Production read-only catalog SELECTs** only; no GRANT/REVOKE, migration, role change, cron change or deployment.

## Explicit ACL findings

Live `pg_class.relacl` on the following five objects is identical:
`{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`.

- `public.nhl_core43_shadow_inputs` — table; owner `postgres`.
- `public.core43_shadow_readiness_v1` — view; owner `postgres`.
- `public.core43_shadow_predictions_v1` — view; owner `postgres`.
- `public.core43_shadow_preview_v1` — view; owner `postgres`.
- `public.nhl_core42_status` — view; owner `postgres`.

The public roles have **direct** explicit grants from `postgres`, not merely inherited rights. `has_table_privilege` confirms SELECT/INSERT/UPDATE/DELETE true for both public roles on all five. The four views have no `security_invoker=true` reloption; they are owner-context views by default.

`public.nhl_prediction_archive`: owner `postgres`; explicit ACL `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=r/postgres}`. Public roles have SELECT true and INSERT/UPDATE/DELETE false.

## Role inheritance and switching

`anon` and `authenticated` each have `rolinherit=true`, `rolbypassrls=false`. `service_role` has `rolinherit=true`, `rolbypassrls=true`. The inspected membership edges show `authenticator` may SET ROLE to `anon`, `authenticated`, `service_role` (each `inherit_option=false, set_option=true, admin_option=false`). `postgres` is a member of those roles with inheritance and SET enabled; `supabase_realtime_admin` can SET those roles without inheritance. No incoming role membership to `anon` or `authenticated` is proof of a separate inherited public grant; direct `relacl` is the primary evidence.

These observations do not prove the ability to modify view rows; SQL view updatability, RLS, and triggers can block DML. The CORE43 shadow inputs table has RLS enabled with no policies (SECURITY-67), so privilege flags alone do not prove a public write vulnerability.

## Proposed exact-ACL rollback process — NOT APPLIED

1. Capture and securely version each production object's `relacl`, owner, `reloptions`, `relrowsecurity`, policy list, grant options, membership and default privileges immediately before a reviewed change.
2. Generate per-grantee/per-grantor privilege and grant-option changes from `aclexplode(relacl)`, not `GRANT ALL` or merely effective `has_table_privilege` bits.
3. Rehearse both the planned restriction and exact baseline restoration in an isolated production-like clone. Include PUBLIC grants, role inheritance, owner context and authorization semantics.
4. Validate anon/authenticated REST and RPC consumers, cron collectors, service role, CORE42 status, analytics and schedule endpoints before any production authorization.
5. Require explicit approval for production rollout; keep a tested reversal and monitoring plan.

## Release gate

**NO-GO**. SECURITY-69/70 green synthetic tests do not constitute an exact production ACL rollback. This is a targeted catalog audit of six objects and selected roles, not a complete cluster-wide privilege review. No production modifications.
