#!/usr/bin/env bash
# SECURITY-81: synthetic local-only capture function privilege regression.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
# verify.sh initializes this database; do not connect to production.
db <<'SQL'
DO $security81$
DECLARE fn oid; owner_name text; config text[]; actual text;
BEGIN
 SELECT p.oid,pg_get_userbyid(p.proowner),p.proconfig INTO fn,owner_name,config
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='capture_core43_shadow_inputs' AND p.pronargs=0;
 IF fn IS NULL THEN RAISE EXCEPTION 'capture function absent'; END IF;
 IF owner_name <> 'security_local' THEN RAISE EXCEPTION 'unexpected synthetic function owner %',owner_name; END IF;
 IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=fn) THEN RAISE EXCEPTION 'capture must be SECURITY DEFINER'; END IF;
 IF NOT ('search_path=public'=ANY(config)) THEN RAISE EXCEPTION 'unexpected synthetic search_path'; END IF;
 IF has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE') THEN
  RAISE EXCEPTION 'public EXECUTE unexpectedly granted';
 END IF;
 IF NOT has_function_privilege('service_role',fn,'EXECUTE') THEN RAISE EXCEPTION 'service EXECUTE missing'; END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN
  RAISE EXCEPTION 'public schema CREATE unexpectedly granted';
 END IF;
END $security81$;
SQL
for role in anon authenticated; do
 if db -Atqc "SET ROLE $role; SELECT public.capture_core43_shadow_inputs()" >/dev/null 2>&1; then
  echo "FAIL SECURITY-81: $role executed capture"; exit 1
 fi
done
# Test privilege regression inside a transaction; never persist the synthetic bad grant.
db <<'SQL'
BEGIN;
GRANT EXECUTE ON FUNCTION public.capture_core43_shadow_inputs() TO anon;
DO $security81$
BEGIN
 IF NOT has_function_privilege('anon','public.capture_core43_shadow_inputs()','EXECUTE') THEN
  RAISE EXCEPTION 'regression detector did not detect temporary bad grant';
 END IF;
END $security81$;
ROLLBACK;
SQL
db -Atqc "SELECT has_function_privilege('anon','public.capture_core43_shadow_inputs()','EXECUTE')" | grep -qx 'f'
echo "PASS SECURITY-81 synthetic capture EXECUTE, owner, SECURITY DEFINER, search_path, schema CREATE and rollback detector"
