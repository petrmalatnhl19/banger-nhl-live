#!/usr/bin/env bash
# SECURITY-70: baseline-derived restoration in disposable PostgreSQL only.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
db <<'SQL'
BEGIN;
-- Recreate broad baseline only in this uncommitted synthetic transaction.
GRANT ALL ON public.nhl_core43_shadow_inputs,
 public.core43_shadow_readiness_v1,public.core43_shadow_predictions_v1,
 public.core43_shadow_preview_v1,public.nhl_core42_status TO anon,authenticated;
CREATE TEMP TABLE baseline AS
SELECT r.rolname AS role_name,c.relname AS object_name,
 p.privilege_type,
 has_table_privilege(r.rolname,c.oid,p.privilege_type) AS granted
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated')) r(rolname)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege_type)
WHERE n.nspname='public' AND c.relname IN
 ('nhl_core43_shadow_inputs','core43_shadow_readiness_v1','core43_shadow_predictions_v1',
  'core43_shadow_preview_v1','nhl_core42_status');
DO $$
DECLARE x record;
BEGIN
 FOR x IN SELECT DISTINCT role_name,object_name FROM baseline LOOP
  IF (SELECT count(*) FROM baseline b WHERE b.role_name=x.role_name AND b.object_name=x.object_name AND granted) <> 7 THEN
   RAISE EXCEPTION 'fixture baseline incomplete: % %',x.role_name,x.object_name;
  END IF;
 END LOOP;
END $$;
-- Apply proposed restriction.
REVOKE ALL ON public.nhl_core43_shadow_inputs,
 public.core43_shadow_readiness_v1,public.core43_shadow_predictions_v1,
 public.core43_shadow_preview_v1 FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
 ON public.nhl_core42_status FROM PUBLIC,anon,authenticated;
-- Restore exact captured effective privilege bits (not blanket GRANT ALL).
DO $$
DECLARE x record;
BEGIN
 FOR x IN SELECT * FROM baseline WHERE granted ORDER BY role_name,object_name,privilege_type LOOP
  EXECUTE format('GRANT %s ON TABLE public.%I TO %I',x.privilege_type,x.object_name,x.role_name);
 END LOOP;
END $$;
DO $$
DECLARE mismatches integer;
BEGIN
 SELECT count(*) INTO mismatches
 FROM baseline b JOIN pg_class c ON c.relname=b.object_name
 JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
 WHERE has_table_privilege(b.role_name,c.oid,b.privilege_type) IS DISTINCT FROM b.granted;
 IF mismatches <> 0 THEN RAISE EXCEPTION 'baseline restore mismatch: %',mismatches; END IF;
END $$;
-- This never commits the broad fixture grants.
ROLLBACK;
SQL
for role in anon authenticated; do
 for obj in nhl_core43_shadow_inputs core43_shadow_readiness_v1 core43_shadow_predictions_v1 core43_shadow_preview_v1; do
  [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.$obj','SELECT')")" == f ]]
 done
 [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.nhl_core42_status','SELECT')")" == t ]]
 [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.nhl_core42_status','UPDATE')")" == f ]]
done
echo 'PASS SECURITY-70 synthetic baseline privilege restore and outer rollback'
