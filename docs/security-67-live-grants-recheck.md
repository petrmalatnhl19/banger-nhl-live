# SECURITY-67 — Fresh read-only production privilege recheck and remediation proposal

Date: 2026-11-17. Project: Supabase `app-development` (`xxwqeiuyislnoxsmjuul`). Live SQL was **SELECT-only** against `pg_class`, `pg_namespace`, `pg_roles`, `pg_policy` and view definitions. No writes, DDL, migrations, permissions changes or production code modifications.

## Live findings

For both `anon` and `authenticated`, PostgreSQL `has_table_privilege` returned **true** for SELECT, INSERT, UPDATE and DELETE on all five:

- `public.nhl_core43_shadow_inputs` (table, RLS enabled, **no policies**)
- `public.core43_shadow_readiness_v1` (view, `security_invoker` option absent)
- `public.core43_shadow_predictions_v1` (view, `security_invoker` option absent)
- `public.core43_shadow_preview_v1` (view, `security_invoker` option absent)
- `public.nhl_core42_status` (view, `security_invoker` option absent)

`public.nhl_prediction_archive`: SELECT true; INSERT/UPDATE/DELETE false for `anon` and `authenticated`. Archive table has RLS enabled and a read policy with `USING (true)`.

The four views have no `security_invoker=true` reloption. PostgreSQL view privileges do not alone demonstrate that a DML statement can modify underlying tables: view updatability, triggers, and RLS can block writes. In particular, the CORE43 shadow inputs table has RLS and no policies. **Do not claim public writes are proven possible**; the confirmed issue is excessive catalog-level grants and potential exposure via default view security.

## Proposed remediation — NOT EXECUTED

1. Inventory application, scheduled functions, APIs, public dashboard, and external consumers of all five objects. Preserve any required public status read path while minimizing internal views' exposure.
2. In an isolated production-like clone, compare effective role privileges, view ownership/security context, RLS and policies; verify both successful authorized requests and denied unauthorized requests.
3. Stage a narrowly scoped **revoke DML** plan for `anon` and `authenticated` on the five listed objects, with explicit per-object rollback grants. Review view SELECT separately, because the public UI or external clients may depend on it. Do not blanket-revoke SELECT or enable `security_invoker` without dependency tests.
4. Confirm that privileged collectors use least-privilege server credentials and no `service_role` credentials leak into browser code.
5. Obtain explicit authorization for production migration and controlled rollout; re-query catalog and run application compatibility checks afterwards.

## Release decision

**NO-GO**: live public-role grants remain overbroad. This recheck confirms the SECURITY-28 historical finding. No production changes were made. This audit does not prove actual DML exploitability, comprehensive consumer compatibility, or that proposed revocations are safe to apply.

Next recommended work: SECURITY-68 consumer dependency/compatibility matrix and **offline-only** proposed GRANT/REVOKE and rollback verification; do not deploy.
