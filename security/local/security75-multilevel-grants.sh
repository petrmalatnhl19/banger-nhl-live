#!/usr/bin/env bash
# SECURITY-75 — multi-level delegated grant chain in isolated PostgreSQL.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
db <<'SQL'
BEGIN;
CREATE ROLE security75_a NOLOGIN;
CREATE ROLE security75_b NOLOGIN;
CREATE ROLE security75_c NOLOGIN;
CREATE ROLE security75_d NOLOGIN;
CREATE TABLE public.security75_fixture (id integer);
INSERT INTO public.security75_fixture VALUES (1);
REVOKE ALL ON public.security75_fixture FROM PUBLIC;
GRANT SELECT ON public.security75_fixture TO security75_a WITH GRANT OPTION;
SET LOCAL ROLE security75_a;
GRANT SELECT ON public.security75_fixture TO security75_b WITH GRANT OPTION;
RESET ROLE;
SET LOCAL ROLE security75_b;
GRANT SELECT ON public.security75_fixture TO security75_c WITH GRANT OPTION;
RESET ROLE;
SET LOCAL ROLE security75_c;
GRANT SELECT ON public.security75_fixture TO security75_d;
RESET ROLE;
CREATE TEMP TABLE security75_baseline AS
 SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.oid='public.security75_fixture'::regclass;
DO $$
BEGIN
 IF NOT has_table_privilege('security75_d','public.security75_fixture','SELECT') THEN
  RAISE EXCEPTION 'leaf missing initial access';
 END IF;
 IF (SELECT count(*) FROM security75_baseline WHERE
   grantor IN (SELECT oid FROM pg_roles WHERE rolname IN ('security75_a','security75_b','security75_c'))) <> 3 THEN
  RAISE EXCEPTION 'expected three delegated edges';
 END IF;
END $$;
REVOKE GRANT OPTION FOR SELECT ON public.security75_fixture FROM security75_a CASCADE;
DO $$
BEGIN
 IF has_table_privilege('security75_b','public.security75_fixture','SELECT')
 OR has_table_privilege('security75_c','public.security75_fixture','SELECT')
 OR has_table_privilege('security75_d','public.security75_fixture','SELECT') THEN
  RAISE EXCEPTION 'cascade failed to remove downstream access';
 END IF;
END $$;
-- Restore in dependency order, preserving each original grantor and grant option.
GRANT SELECT ON public.security75_fixture TO security75_a WITH GRANT OPTION;
SET LOCAL ROLE security75_a;
GRANT SELECT ON public.security75_fixture TO security75_b WITH GRANT OPTION;
RESET ROLE;
SET LOCAL ROLE security75_b;
GRANT SELECT ON public.security75_fixture TO security75_c WITH GRANT OPTION;
RESET ROLE;
SET LOCAL ROLE security75_c;
GRANT SELECT ON public.security75_fixture TO security75_d;
RESET ROLE;
DO $$
DECLARE mismatch integer;
BEGIN
 WITH actual AS (
  SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable
  FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE c.oid='public.security75_fixture'::regclass
 ), differences AS (
  (SELECT * FROM security75_baseline EXCEPT ALL SELECT * FROM actual)
  UNION ALL
  (SELECT * FROM actual EXCEPT ALL SELECT * FROM security75_baseline)
 )
 SELECT count(*) INTO mismatch FROM differences;
 IF mismatch <> 0 THEN RAISE EXCEPTION 'ACL chain restore mismatch: %',mismatch; END IF;
 IF NOT has_table_privilege('security75_d','public.security75_fixture','SELECT') THEN
  RAISE EXCEPTION 'leaf access not restored';
 END IF;
END $$;
ROLLBACK;
SQL
[[ "$(db -Atqc "SELECT count(*) FROM pg_roles WHERE rolname LIKE 'security75_%'")" == 0 ]]
[[ "$(db -Atqc "SELECT to_regclass('public.security75_fixture') IS NULL")" == t ]]
echo 'PASS SECURITY-75 multi-level grant chain CASCADE and exact restoration'
