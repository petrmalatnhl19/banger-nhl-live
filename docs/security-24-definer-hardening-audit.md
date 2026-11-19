# SECURITY-24 — SECURITY DEFINER hardening audit

Read-only production inspection, 2026-11-16; Supabase project `app-development`. **No production changes.**

## Verified production catalog

- `public.capture_core43_shadow_inputs()` and `public.core43_capture_on_core42_insert()` are `SECURITY DEFINER`, owned by `postgres`, and both set `search_path=public`.
- Function ACL for each: `postgres=X/postgres,service_role=X/postgres`. `anon` and `authenticated` do not have EXECUTE.
- Schema `public` owner is `pg_database_owner`; schema ACL grants usage (U) but not create (C) to PUBLIC, anon, authenticated, service_role. Catalog checks confirmed CREATE=false for all three API roles.
- SECURITY-23 synthetic fixture checks capture after local revocation, and SECURITY-24 adds assertions for function configuration, role EXECUTE, and CREATE privileges.

## Security assessment

1. No obvious schema-object shadowing route for ordinary anon/authenticated/service_role via CREATE in public under the observed grants.
2. `search_path=public` is **not the most restrictive** configuration for a SECURITY DEFINER function. A hardened path such as `pg_catalog, public, pg_temp` or an empty search path with fully qualified references may be preferable, but must be validated against PL/pgSQL resolution and temporary-object behavior in isolated PostgreSQL first.
3. The trigger function reads OLD/NEW and calls a schema-qualified capture function. The capture function uses schema-qualified application tables, but uses built-in functions and operators; verify function/operator resolution and temp schema behavior before proposing a change.
4. This inspection does not prove absence of risks from other privileged roles, role membership, extensions, dynamic SQL elsewhere, or future schema grants.

## Release gate

- Keep SECURITY-17 **NO-GO**; no changes to production search_path, ACLs, trigger, CORE 4.2 or deployment.
- Next: run isolated adversarial tests for temporary-object shadowing and compare candidate hardened search_path settings; then perform complete consumer inventory.
