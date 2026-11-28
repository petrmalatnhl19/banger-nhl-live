# SECURITY-06 — proposed scoped public access remediation (REVIEW ONLY)

Date: 2026-11-16. This file is a **proposal**, not an applied migration. Do not merge/deploy or run in production until consumers, role behavior and rollback are validated.

## Verified context

- The production `public.core43_shadow_readiness_v1`, `core43_shadow_predictions_v1` and `core43_shadow_preview_v1` views are owner-privileged views, readable by `anon` and `authenticated`, and depend on private CORE 4.3 tables.
- `public.nhl_core43_shadow_inputs` is RLS-enabled with no policies, yet has broad grants to both public roles.
- Direct string checks of main `index.html` (main branch) did not find references to the five examined view names; this is **not** a complete consumer inventory.
- Public aggregate status and model accuracy views should remain available until verified otherwise.

## Candidate migration (NOT APPROVED)

This proposal restricts SELECT on the three *internal* CORE 4.3 views as well as excessive write grants. This is **stricter** than SECURITY-01's initial proposal and must be compatibility tested separately.

```sql
BEGIN;

-- RLS remains enabled; remove redundant direct public grants.
REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs
  FROM PUBLIC, anon, authenticated;

-- Internal experimental views: no public read or write.
REVOKE ALL ON TABLE
  public.core43_shadow_readiness_v1,
  public.core43_shadow_predictions_v1,
  public.core43_shadow_preview_v1
  FROM PUBLIC, anon, authenticated;

-- Public aggregate status remains readable; remove excess privileges.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.nhl_core42_status
  FROM PUBLIC, anon, authenticated;

-- Intentionally unchanged:
-- public.nhl_core43_public_schedule_evidence
-- public.nhl_core_model_accuracy
-- public.nhl_core_model_head_to_head
-- public.nhl_core_model_trend
-- public.nhl_prediction_archive

COMMIT;
```

## Potential regression risks

- Any frontend, cron job, or edge function using an anon/authenticated token to query the three experiment views will receive permission denied.
- `service_role` and owner grants are not explicitly revoked here, but verify any inherited/public grants and actual role paths.
- Removing public SELECT from internal views does **not** remove the Supabase advisor's SECURITY DEFINER warnings. A later architectural change is needed if the aim is to eliminate those warnings.

## Preflight gates

1. Search **all** repository scripts, SQL, workflow and edge functions; also audit external clients.
2. Capture current grants, policies, view definitions, API responses and intended public endpoints.
3. Test the migration on an isolated/staging database with equivalent schema and representative non-sensitive data.
4. Verify anonymous and authenticated clients can still read public score, schedule, accuracy and CORE 4.2 status endpoints.
5. Verify anonymous and authenticated clients cannot read internal CORE 4.3 experiment views after the change.
6. Confirm no production CORE 4.2 calculation, archive data or frontend behavior changes.
7. Obtain explicit approval before applying production SQL; keep this PR Draft.

## Suggested post-change read-only check

```sql
SELECT c.relname, r.rolname,
       has_table_privilege(r.rolname,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.rolname,c.oid,'INSERT') AS can_insert,
       has_table_privilege(r.rolname,c.oid,'UPDATE') AS can_update,
       has_table_privilege(r.rolname,c.oid,'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated')
  AND c.relname IN (
    'nhl_core43_shadow_inputs','core43_shadow_readiness_v1',
    'core43_shadow_predictions_v1','core43_shadow_preview_v1',
    'nhl_core42_status','nhl_core43_public_schedule_evidence',
    'nhl_core_model_accuracy','nhl_core_model_head_to_head',
    'nhl_core_model_trend','nhl_prediction_archive')
ORDER BY c.relname,r.rolname;
```

Expected after approval and deployment: `can_select=false` on the three experiment views and `nhl_core43_shadow_inputs`; public aggregate/schedule/archive reads remain as before.
