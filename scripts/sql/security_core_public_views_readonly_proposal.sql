-- PROPOSAL ONLY. Never execute without explicit production approval.
-- Keep SELECT and all service_role privileges unchanged.
-- Six non-updatable public reporting views; do not change the schedule evidence view.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.core43_shadow_predictions_v1 FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.core43_shadow_preview_v1 FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.nhl_core42_status FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.nhl_core_model_accuracy FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.nhl_core_model_head_to_head FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.nhl_core_model_trend FROM anon, authenticated;

-- Post-deployment read-only verification: all six must show SELECT=true and writes=false.
SELECT c.relname, r.rolname,
  has_table_privilege(r.rolname,c.oid,'SELECT') AS can_select,
  has_table_privilege(r.rolname,c.oid,'INSERT') AS can_insert,
  has_table_privilege(r.rolname,c.oid,'UPDATE') AS can_update,
  has_table_privilege(r.rolname,c.oid,'DELETE') AS can_delete,
  has_table_privilege(r.rolname,c.oid,'TRUNCATE') AS can_truncate,
  has_table_privilege(r.rolname,c.oid,'REFERENCES') AS can_reference,
  has_table_privilege(r.rolname,c.oid,'TRIGGER') AS can_trigger
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated')) r(rolname)
WHERE n.nspname='public' AND c.relname IN ('core43_shadow_predictions_v1', 'core43_shadow_preview_v1', 'nhl_core42_status', 'nhl_core_model_accuracy', 'nhl_core_model_head_to_head', 'nhl_core_model_trend')
ORDER BY c.relname,r.rolname;
