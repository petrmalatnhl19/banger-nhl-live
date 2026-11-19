#!/usr/bin/env bash
# SECURITY-76: independent grant paths, selective CASCADE, exact ACL recovery.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
db <<'SQL'
BEGIN;
CREATE ROLE security76_a NOLOGIN;
CREATE ROLE security76_b NOLOGIN;
CREATE ROLE security76_leaf NOLOGIN;
CREATE TABLE public.security76_fixture(id integer);
INSERT INTO public.security76_fixture VALUES (1);
REVOKE ALL ON public.security76_fixture FROM PUBLIC;
GRANT SELECT ON public.security76_fixture TO security76_a WITH GRANT OPTION;
GRANT SELECT ON public.security76_fixture TO security76_b WITH GRANT OPTION;
SET LOCAL ROLE security76_a;
GRANT SELECT ON public.security76_fixture TO security76_leaf;
RESET ROLE;
SET LOCAL ROLE security76_b;
GRANT SELECT ON public.security76_fixture TO security76_leaf;
RESET ROLE;
CREATE TEMP TABLE security76_baseline AS
 SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.oid='public.security76_fixture'::regclass;
DO $$
BEGIN
 IF (SELECT count(DISTINCT grantor) FROM security76_baseline
     WHERE grantee=(SELECT oid FROM pg_roles WHERE rolname='security76_leaf')) <> 2 THEN
  RAISE EXCEPTION 'expected two independent paths';
 END IF;
END $$;
REVOKE GRANT OPTION FOR SELECT ON public.security76_fixture FROM security76_a CASCADE;
DO $$
BEGIN
 IF NOT has_table_privilege('security76_leaf','public.security76_fixture','SELECT') THEN
  RAISE EXCEPTION 'independent path B did not preserve access';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE c.oid='public.security76_fixture'::regclass
   AND a.grantor=(SELECT oid FROM pg_roles WHERE rolname='security76_a')
   AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='security76_leaf')
 ) THEN RAISE EXCEPTION 'revoked path A survived'; END IF;
END $$;
REVOKE GRANT OPTION FOR SELECT ON public.security76_fixture FROM security76_b CASCADE;
DO $$
BEGIN
 IF has_table_privilege('security76_leaf','public.security76_fixture','SELECT') THEN
  RAISE EXCEPTION 'leaf retained access after both paths revoked';
 END IF;
END $$;
GRANT SELECT ON public.security76_fixture TO security76_a WITH GRANT OPTION;
GRANT SELECT ON public.security76_fixture TO security76_b WITH GRANT OPTION;
SET LOCAL ROLE security76_a;
GRANT SELECT ON public.security76_fixture TO security76_leaf;
RESET ROLE;
SET LOCAL ROLE security76_b;
GRANT SELECT ON public.security76_fixture TO security76_leaf;
RESET ROLE;
DO $$
DECLARE mismatch integer;
BEGIN
 WITH actual AS (
  SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable
  FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE c.oid='public.security76_fixture'::regclass
 ), differences AS (
  (SELECT * FROM security76_baseline EXCEPT ALL SELECT * FROM actual)
  UNION ALL
  (SELECT * FROM actual EXCEPT ALL SELECT * FROM security76_baseline)
 )
 SELECT count(*) INTO mismatch FROM differences;
 IF mismatch <> 0 THEN RAISE EXCEPTION 'multi-path ACL mismatch: %',mismatch; END IF;
END $$;
ROLLBACK;
SQL
[[ "$(db -Atqc "SELECT count(*) FROM pg_roles WHERE rolname LIKE 'security76_%'")" == 0 ]]
[[ "$(db -Atqc "SELECT to_regclass('public.security76_fixture') IS NULL")" == t ]]
echo 'PASS SECURITY-76 independent paths, selective CASCADE, ACL restoration'
