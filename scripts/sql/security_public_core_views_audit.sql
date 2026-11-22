-- SECURITY: read-only inventory of public CORE views. No DDL, no data access.
-- Execute in Supabase SQL editor; review results before any grants or view changes.
WITH target(name) AS (VALUES
 ('nhl_core42_status'),('nhl_core_model_accuracy'),
 ('nhl_core_model_head_to_head'),('nhl_core_model_trend'),
 ('core43_shadow_predictions_v1'),('core43_shadow_preview_v1'),
 ('core43_shadow_readiness_v1'),('nhl_core43_public_schedule_evidence')
)
SELECT t.name AS view_name,
       pg_get_userbyid(c.relowner) AS owner,
       c.reloptions,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_can_select,
       pg_get_viewdef(c.oid, true) AS definition
FROM target t
LEFT JOIN pg_class c ON c.relname=t.name AND c.relnamespace='public'::regnamespace AND c.relkind='v'
ORDER BY t.name;

-- Check base-table privileges and RLS policy counts before considering security_invoker.
WITH target(name) AS (VALUES
 ('nhl_prediction_archive'),('nhl_core43_shadow_inputs'),
 ('nhl_core43_goalie_snapshots'),('nhl_core43_starter_evidence'),
 ('nhl_core43_schedule_snapshots')
)
SELECT t.name AS table_name, c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_can_select,
       has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_can_select,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.name) AS policy_count
FROM target t
LEFT JOIN pg_class c ON c.relname=t.name AND c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
ORDER BY t.name;
