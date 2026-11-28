#!/usr/bin/env bash
# SECURITY-73 — synthetic role inheritance, grant options and rollback.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
db <<'SQL'
BEGIN;
CREATE ROLE security73_parent NOLOGIN;
CREATE ROLE security73_child_inherit NOLOGIN;
CREATE ROLE security73_child_noinherit NOLOGIN;
CREATE ROLE security73_delegate NOLOGIN;
CREATE TABLE public.security73_fixture (id integer);
INSERT INTO public.security73_fixture VALUES (1);
REVOKE ALL ON TABLE public.security73_fixture FROM PUBLIC;
GRANT SELECT ON TABLE public.security73_fixture TO security73_parent WITH GRANT OPTION;
GRANT security73_parent TO security73_child_inherit WITH INHERIT TRUE, SET TRUE;
GRANT security73_parent TO security73_child_noinherit WITH INHERIT FALSE, SET TRUE;
DO $$
BEGIN
 IF NOT has_table_privilege('security73_parent','public.security73_fixture','SELECT') THEN
  RAISE EXCEPTION 'parent must have SELECT';
 END IF;
 IF NOT has_table_privilege('security73_child_inherit','public.security73_fixture','SELECT') THEN
  RAISE EXCEPTION 'inheriting child must have SELECT';
 END IF;
 IF has_table_privilege('security73_child_noinherit','public.security73_fixture','SELECT') THEN
  RAISE EXCEPTION 'non-inheriting child unexpectedly has SELECT';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
  JOIN pg_roles r ON r.oid=a.grantee
  WHERE c.oid='public.security73_fixture'::regclass
    AND r.rolname='security73_parent' AND a.privilege_type='SELECT' AND a.is_grantable
 ) THEN RAISE EXCEPTION 'parent grant option absent'; END IF;
END $$;
-- Verify real SQL role switching, not merely catalog privilege flags.
SET LOCAL ROLE security73_child_inherit;
SELECT count(*) FROM public.security73_fixture;
RESET ROLE;
-- A non-inheriting role cannot read unless it explicitly switches to the parent.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_auth_members m
  JOIN pg_roles child ON child.oid=m.member
  JOIN pg_roles parent ON parent.oid=m.roleid
  WHERE child.rolname='security73_child_noinherit'
    AND parent.rolname='security73_parent'
    AND NOT m.inherit_option AND m.set_option
 ) THEN RAISE EXCEPTION 'membership flags not preserved'; END IF;
END $$;
-- Exercise delegation using the grant option under the granting role.
SET LOCAL ROLE security73_parent;
GRANT SELECT ON TABLE public.security73_fixture TO security73_delegate;
RESET ROLE;
DO $$
BEGIN
 IF NOT has_table_privilege('security73_delegate','public.security73_fixture','SELECT') THEN
  RAISE EXCEPTION 'delegated privilege missing';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE c.oid='public.security73_fixture'::regclass
    AND a.grantor=(SELECT oid FROM pg_roles WHERE rolname='security73_parent')
    AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='security73_delegate')
    AND a.privilege_type='SELECT' AND NOT a.is_grantable
 ) THEN RAISE EXCEPTION 'delegated grantor provenance mismatch'; END IF;
END $$;
-- Revocation with CASCADE removes delegated rights; restore grant option and delegation.
REVOKE GRANT OPTION FOR SELECT ON TABLE public.security73_fixture
 FROM security73_parent CASCADE;
DO $$
BEGIN
 IF has_table_privilege('security73_delegate','public.security73_fixture','SELECT') THEN
  RAISE EXCEPTION 'delegated privilege survived CASCADE';
 END IF;
END $$;
GRANT SELECT ON TABLE public.security73_fixture TO security73_parent WITH GRANT OPTION;
SET LOCAL ROLE security73_parent;
GRANT SELECT ON TABLE public.security73_fixture TO security73_delegate;
RESET ROLE;
DO $$
BEGIN
 IF NOT has_table_privilege('security73_delegate','public.security73_fixture','SELECT') THEN
  RAISE EXCEPTION 'delegation not restored';
 END IF;
END $$;
ROLLBACK;
SQL
# Transactional cleanup: temporary roles and fixture table must not persist.
[[ "$(db -Atqc "SELECT count(*) FROM pg_roles WHERE rolname LIKE 'security73_%'")" == 0 ]]
[[ "$(db -Atqc "SELECT to_regclass('public.security73_fixture') IS NULL")" == t ]]
echo 'PASS SECURITY-73 inheritance, grant-option delegation, CASCADE and rollback'
