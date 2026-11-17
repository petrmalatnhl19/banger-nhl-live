#!/usr/bin/env bash
# SECURITY-74: synthetic multi-grantor ACL graph restoration.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
db <<'SQL'
BEGIN;
CREATE ROLE security74_grantor_a NOLOGIN;
CREATE ROLE security74_grantor_b NOLOGIN;
CREATE ROLE security74_reader_a NOLOGIN;
CREATE ROLE security74_reader_b NOLOGIN;
CREATE TABLE public.security74_fixture (id integer);
INSERT INTO public.security74_fixture VALUES (1);
REVOKE ALL ON public.security74_fixture FROM PUBLIC;
GRANT SELECT ON public.security74_fixture TO security74_grantor_a WITH GRANT OPTION;
GRANT SELECT ON public.security74_fixture TO security74_grantor_b WITH GRANT OPTION;
SET LOCAL ROLE security74_grantor_a;
GRANT SELECT ON public.security74_fixture TO security74_reader_a;
RESET ROLE;
SET LOCAL ROLE security74_grantor_b;
GRANT SELECT ON public.security74_fixture TO security74_reader_b;
RESET ROLE;
CREATE TEMP TABLE security74_baseline AS
 SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.oid='public.security74_fixture'::regclass;
DO $$
BEGIN
 IF (SELECT count(DISTINCT grantor) FROM security74_baseline
     WHERE grantee IN (SELECT oid FROM pg_roles WHERE rolname LIKE 'security74_reader_%')) <> 2 THEN
  RAISE EXCEPTION 'two distinct grantors required';
 END IF;
END $$;
REVOKE GRANT OPTION FOR SELECT ON public.security74_fixture FROM security74_grantor_a CASCADE;
REVOKE GRANT OPTION FOR SELECT ON public.security74_fixture FROM security74_grantor_b CASCADE;
DO $$
BEGIN
 IF has_table_privilege('security74_reader_a','public.security74_fixture','SELECT')
 OR has_table_privilege('security74_reader_b','public.security74_fixture','SELECT') THEN
  RAISE EXCEPTION 'cascade did not remove both delegated grants';
 END IF;
END $$;
-- Restore parent grant options first, then restore each delegated edge as its original grantor.
GRANT SELECT ON public.security74_fixture TO security74_grantor_a WITH GRANT OPTION;
GRANT SELECT ON public.security74_fixture TO security74_grantor_b WITH GRANT OPTION;
SET LOCAL ROLE security74_grantor_a;
GRANT SELECT ON public.security74_fixture TO security74_reader_a;
RESET ROLE;
SET LOCAL ROLE security74_grantor_b;
GRANT SELECT ON public.security74_fixture TO security74_reader_b;
RESET ROLE;
DO $$
DECLARE mismatch_count integer;
BEGIN
 WITH current_acl AS (
  SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable
  FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE c.oid='public.security74_fixture'::regclass
 ), differences AS (
  (SELECT * FROM security74_baseline EXCEPT ALL SELECT * FROM current_acl)
  UNION ALL
  (SELECT * FROM current_acl EXCEPT ALL SELECT * FROM security74_baseline)
 )
 SELECT count(*) INTO mismatch_count FROM differences;
 IF mismatch_count <> 0 THEN RAISE EXCEPTION 'multi-grantor ACL mismatch: %',mismatch_count; END IF;
END $$;
ROLLBACK;
SQL
[[ "$(db -Atqc "SELECT count(*) FROM pg_roles WHERE rolname LIKE 'security74_%'")" == 0 ]]
[[ "$(db -Atqc "SELECT to_regclass('public.security74_fixture') IS NULL")" == t ]]
echo 'PASS SECURITY-74 multi-grantor ACL graph restoration'
