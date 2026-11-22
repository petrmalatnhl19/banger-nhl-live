-- Proposed production migration. DO NOT execute without separate approval.
-- Remove anonymous/authenticated access to the internal CORE 4.3 readiness view.
-- Only the view ACL changes: no base-table grants, RLS or CORE model logic changes.
REVOKE ALL PRIVILEGES ON TABLE public.core43_shadow_readiness_v1 FROM anon, authenticated;
-- Explicitly preserve the privileged service consumer.
GRANT SELECT ON TABLE public.core43_shadow_readiness_v1 TO service_role;

-- Post-deployment verification (read-only):
-- SELECT has_table_privilege('anon','public.core43_shadow_readiness_v1','SELECT') AS anon_select,
--        has_table_privilege('authenticated','public.core43_shadow_readiness_v1','SELECT') AS authenticated_select,
--        has_table_privilege('service_role','public.core43_shadow_readiness_v1','SELECT') AS service_select;
