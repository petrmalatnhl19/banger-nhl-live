-- Synthetic objects in a fresh database. Every change is transaction-local.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'grants_fixture' THEN
    RAISE EXCEPTION 'Expected disposable grants_fixture database';
  END IF;
END $$;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.favorite_players (id integer);
CREATE TABLE public.nhl_core43_shadow_inputs (id integer);
GRANT ALL ON public.favorite_players, public.nhl_core43_shadow_inputs
  TO anon, authenticated, service_role;

-- SECURITY-87 technique: snapshot the ACL and check the role's effective rights.
CREATE TEMP VIEW grants_matrix AS
SELECT c.relname, a.grantor, a.grantee, a.privilege_type, a.is_grantable
FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
WHERE c.oid IN ('public.favorite_players'::regclass, 'public.nhl_core43_shadow_inputs'::regclass);
CREATE TEMP TABLE original_grants AS TABLE grants_matrix;

CREATE FUNCTION pg_temp.check_access(expect_truncate boolean) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  target regclass;
  api_role text;
BEGIN
  FOREACH target IN ARRAY ARRAY['public.favorite_players'::regclass, 'public.nhl_core43_shadow_inputs'::regclass] LOOP
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(api_role, target, 'TRUNCATE') <> expect_truncate THEN
        RAISE EXCEPTION 'Unexpected TRUNCATE for % on %', api_role, target;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT (has_table_privilege('authenticated','public.favorite_players','SELECT')
      AND has_table_privilege('authenticated','public.favorite_players','INSERT')
      AND has_table_privilege('authenticated','public.favorite_players','DELETE')
      AND has_table_privilege('service_role','public.nhl_core43_shadow_inputs','INSERT')) THEN
    RAISE EXCEPTION 'Expected application or collector privilege lost';
  END IF;
END $$;

SELECT pg_temp.check_access(true);
REVOKE TRUNCATE ON public.favorite_players, public.nhl_core43_shadow_inputs FROM anon, authenticated;
SELECT pg_temp.check_access(false);

-- Restoring only those four grants must reconstruct the entire baseline ACL.
GRANT TRUNCATE ON public.favorite_players, public.nhl_core43_shadow_inputs TO anon, authenticated;
SELECT pg_temp.check_access(true);
DO $$ BEGIN
  IF EXISTS ((TABLE grants_matrix EXCEPT TABLE original_grants)
       UNION ALL (TABLE original_grants EXCEPT TABLE grants_matrix)) THEN
    RAISE EXCEPTION 'Restored grants differ from baseline';
  END IF;
END $$;
ROLLBACK;
