# SECURITY-01 — proposed Supabase grants hardening (NOT DEPLOYED)

This document is **review-only**. Do not execute the SQL until the production frontend and API consumers have been audited. Do not merge or deploy automatically. No changes to CORE 4.2 computations, archived predictions, or database data.

## Observed in production (2026-11-16, read-only SQL)

- `public.nhl_core43_shadow_inputs`: RLS enabled, no policies, but `anon` and `authenticated` have broad table-level grants.
- `public.core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, `core43_shadow_readiness_v1`, `nhl_core42_status`: public roles have broad grants; these views are not directly updatable.
- `public.nhl_core43_public_schedule_evidence`: SELECT-only public grants; intentionally narrow 4-column schedule view. Leave unchanged.
- `public.nhl_prediction_archive`: public SELECT-only grants, RLS enabled. Leave unchanged.
- Supabase security advisor reports 8 SECURITY DEFINER views. Their public exposure and dependencies need a separate review before changing `security_invoker`.

## Proposed minimal SQL (manual approval only)

```sql
BEGIN;

REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.core43_shadow_predictions_v1,
           public.core43_shadow_preview_v1,
           public.core43_shadow_readiness_v1,
           public.nhl_core42_status
  FROM PUBLIC, anon, authenticated;

-- Preserve existing SELECT on the views for compatibility.
-- Do not grant SELECT on nhl_core43_shadow_inputs.
COMMIT;
```

Note: this does **not** remove the experimental views' public SELECT access or their SECURITY DEFINER behavior. Investigate whether the readiness view leaks internal goalie/evidence fields; restrict SELECT in a separate, compatibility-tested change if required. Do not assume view-level non-updatability prevents all security risks.

## Read-only verification query

```sql
SELECT c.relname AS object_name, r.rolname AS role_name,
       has_table_privilege(r.rolname,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.rolname,c.oid,'INSERT') AS can_insert,
       has_table_privilege(r.rolname,c.oid,'UPDATE') AS can_update,
       has_table_privilege(r.rolname,c.oid,'DELETE') AS can_delete,
       c.relrowsecurity AS rls_enabled,
       pg_relation_is_updatable(c.oid,true) AS update_mask
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public'
  AND r.rolname IN ('anon','authenticated')
  AND c.relname IN ('nhl_core43_shadow_inputs',
    'core43_shadow_predictions_v1','core43_shadow_preview_v1',
    'core43_shadow_readiness_v1','nhl_core42_status',
    'nhl_core43_public_schedule_evidence','nhl_prediction_archive')
ORDER BY c.relname,r.rolname;
```

## Acceptance gates

1. Identify all frontend, edge function and automation consumers of the five objects.
2. Confirm whether public SELECT on experimental views is intended; assess SECURITY DEFINER data exposure.
3. Run baseline read-only verification and capture security advisor findings.
4. Approve the exact SQL separately, execute only during a controlled maintenance window.
5. Repeat privilege verification and functional smoke tests with actual anon/authenticated credentials.
6. Keep PR in Draft until reviewed. Never run a destructive write probe against production.
