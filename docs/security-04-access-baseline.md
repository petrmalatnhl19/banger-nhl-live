# SECURITY-04 — database access baseline and verification plan

**Status:** baseline verified using read-only SQL, 2026-11-16. No database mutation. Companion to SECURITY-01 in Draft PR #274.

## Baseline observations

| Object | anon SELECT | authenticated SELECT | RLS | Notes |
|---|---|---|---|---|
| nhl_core43_shadow_inputs | GRANTED | GRANTED | enabled, 0 policies | Grants do not mean rows are accessible under RLS |
| core43_shadow_predictions_v1 | GRANTED | GRANTED | view | SECURITY DEFINER advisor finding |
| core43_shadow_preview_v1 | GRANTED | GRANTED | view | SECURITY DEFINER advisor finding |
| core43_shadow_readiness_v1 | GRANTED | GRANTED | view | SECURITY DEFINER advisor finding; contains goalie/evidence fields |
| nhl_core42_status | GRANTED | GRANTED | view | Aggregate counts only |
| nhl_core43_public_schedule_evidence | GRANTED | GRANTED | view | Four schedule fields, public SELECT-only |
| nhl_prediction_archive | GRANTED | GRANTED | enabled, 1 policy | Public SELECT-only |

**Caveats:** The above are table-level catalog privileges, not live HTTP API or end-to-end authorization tests. `pg_relation_is_updatable` returns 0 for the examined views, but that does not establish that SECURITY DEFINER views are safe. GitHub code search for three object names returned no results; this does not prove no consumers exist.

## Safety decisions

1. Keep PR #274 Draft. Do not merge or deploy.
2. No GRANT/REVOKE until public frontend, edge functions, cron jobs, and external consumers have been inventoried.
3. SECURITY-01 SQL reduces excess grants but **does not remove public SELECT** from experimental SECURITY DEFINER views. Decide this separately.
4. Do not blindly set `security_invoker=true`: these views depend on RLS-protected private tables and could stop returning results.
5. Do not test INSERT/UPDATE/DELETE against production, even inside a rollback transaction.

## Read-only SQL baseline and post-change check

```sql
SELECT c.relname, r.rolname,
       has_table_privilege(r.rolname,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.rolname,c.oid,'INSERT') AS can_insert,
       has_table_privilege(r.rolname,c.oid,'UPDATE') AS can_update,
       has_table_privilege(r.rolname,c.oid,'DELETE') AS can_delete,
       c.relrowsecurity,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count,
       c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public'
  AND r.rolname IN ('anon','authenticated')
  AND c.relname IN (
    'nhl_core43_shadow_inputs',
    'core43_shadow_predictions_v1',
    'core43_shadow_preview_v1',
    'core43_shadow_readiness_v1',
    'nhl_core42_status',
    'nhl_core43_public_schedule_evidence',
    'nhl_prediction_archive'
  )
ORDER BY c.relname,r.rolname;
```

## Required acceptance checks after separately approved migration

- No INSERT, UPDATE or DELETE grants to `anon`/`authenticated` on the five target objects.
- `nhl_core43_shadow_inputs`: no direct public grants; RLS still enabled.
- Intended public SELECT on status and schedule views remains functional.
- Experimental view SELECT exposure is documented and approved or restricted in a separate compatibility-tested change.
- Run Supabase security advisors and compare SECURITY DEFINER findings.
- Run frontend and browser smoke CI, plus real anon/authenticated API read tests with non-sensitive fixtures.
- Verify CORE 4.2 archive data and production prediction computations are unchanged.
