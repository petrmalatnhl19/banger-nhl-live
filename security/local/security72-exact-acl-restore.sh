#!/usr/bin/env bash
# SECURITY-72: exact ACL-entry restoration in disposable synthetic PostgreSQL only.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
db <<'SQL'
BEGIN;
-- Reconstruct a synthetic broad baseline inside a transaction; do not commit it.
GRANT ALL ON TABLE public.nhl_core43_shadow_inputs,
 public.core43_shadow_readiness_v1,public.core43_shadow_predictions_v1,
 public.core43_shadow_preview_v1,public.nhl_core42_status TO anon,authenticated;
CREATE TEMP TABLE acl72_baseline AS
SELECT c.oid AS object_oid,c.relname AS object_name,
 a.grantor,a.grantee,a.privilege_type,a.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) a
WHERE n.nspname='public' AND c.relname IN
 ('nhl_core43_shadow_inputs','core43_shadow_readiness_v1',
  'core43_shadow_predictions_v1','core43_shadow_preview_v1','nhl_core42_status');
DO $$
BEGIN
 IF (SELECT count(*) FROM acl72_baseline WHERE grantee IN
   (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated'))) < 10 THEN
  RAISE EXCEPTION 'baseline capture incomplete';
 END IF;
END $$;
-- Restrict only public roles, preserving service_role and owner grants.
REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs,
 public.core43_shadow_readiness_v1,public.core43_shadow_predictions_v1,
 public.core43_shadow_preview_v1 FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
 ON TABLE public.nhl_core42_status FROM PUBLIC,anon,authenticated;
-- Restore every missing ACL entry, retaining grantor, grantee and grant-option semantics.
-- In this fixture all grants originate from postgres, the database owner.
DO $$
DECLARE x record;
BEGIN
 FOR x IN
  SELECT b.* FROM acl72_baseline b
  WHERE NOT EXISTS (
   SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
   WHERE c.oid=b.object_oid AND a.grantor=b.grantor
     AND a.grantee=b.grantee AND a.privilege_type=b.privilege_type
     AND a.is_grantable=b.is_grantable)
  ORDER BY object_name,grantee,privilege_type
 LOOP
  IF x.grantor <> (SELECT oid FROM pg_roles WHERE rolname='postgres') THEN
   RAISE EXCEPTION 'unsupported grantor in synthetic fixture';
  END IF;
  EXECUTE format('GRANT %s ON TABLE public.%I TO %s%s',
   x.privilege_type,x.object_name,
   CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE quote_ident((SELECT rolname FROM pg_roles WHERE oid=x.grantee)) END,
   CASE WHEN x.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
END $$;
-- Compare normalized ACL entries including grantor and grant option, not just effective bits.
DO $$
DECLARE mismatch_count integer;
BEGIN
 WITH current_acl AS (
  SELECT c.oid AS object_oid,a.grantor,a.grantee,a.privilege_type,a.is_grantable
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE n.nspname='public' AND c.relname IN
   ('nhl_core43_shadow_inputs','core43_shadow_readiness_v1',
    'core43_shadow_predictions_v1','core43_shadow_preview_v1','nhl_core42_status')
 ), diff AS (
  (SELECT object_oid,grantor,grantee,privilege_type,is_grantable FROM acl72_baseline
   EXCEPT ALL SELECT * FROM current_acl)
  UNION ALL
  (SELECT * FROM current_acl EXCEPT ALL
   SELECT object_oid,grantor,grantee,privilege_type,is_grantable FROM acl72_baseline)
 )
 SELECT count(*) INTO mismatch_count FROM diff;
 IF mismatch_count <> 0 THEN RAISE EXCEPTION 'ACL restoration mismatch: %',mismatch_count; END IF;
END $$;
ROLLBACK;
SQL
# Verify the committed restricted baseline was not modified.
for role in anon authenticated; do
 for obj in nhl_core43_shadow_inputs core43_shadow_readiness_v1 core43_shadow_predictions_v1 core43_shadow_preview_v1; do
  [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.$obj','SELECT')")" == f ]]
 done
 [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.nhl_core42_status','SELECT')")" == t ]]
 [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.nhl_core42_status','UPDATE')")" == f ]]
done
echo 'PASS SECURITY-72 synthetic ACL grantor/grantee/privilege/grant-option restoration'
