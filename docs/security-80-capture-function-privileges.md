# SECURITY-80 — Production SECURITY DEFINER capture function privilege audit

Date: 2026-11-17. Production Supabase project `app-development` (`xxwqeiuyislnoxsmjuul`). **Read-only catalog SELECTs**. Draft PR #274. **NO-GO**.

## Confirmed current state

`public.capture_core43_shadow_inputs()` has no arguments, returns integer, is owned by `postgres`, and is `SECURITY DEFINER`. Its exact function ACL is `{postgres=X/postgres,service_role=X/postgres}`. Effective EXECUTE: `anon=false`, `authenticated=false`, `service_role=true`. Thus direct public-role EXECUTE is not currently granted. This does **not** establish that indirect calls via other privileged endpoints or compromised service credentials are impossible.

The function has `SET search_path TO 'public'`. Its inspected body uses schema-qualified `public.` relation names for reads/writes; it reads frozen `nhl_prediction_archive` entries, joins `nhl_core43_goalie_snapshots` and `nhl_core43_starter_evidence` with pre-prediction timestamp cutoffs, and INSERTs into `public.nhl_core43_shadow_inputs` using `ON CONFLICT (game_id,side) DO NOTHING`. This is a code-path inspection, not an execution or correctness proof. A hardened search_path should be assessed in isolated staging; do not blindly modify production.

`cron.job` ID 5, `banger-core43-shadow-capture`, is active, stored username `postgres`, and invokes the capture function. No job was executed or altered.

`public` schema ACL is `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}`. Effective CREATE on public is false for `anon` and `authenticated`; they cannot create schema objects under those role privileges. This reduces a specific search_path shadowing concern, but does not prove security against all privileged actors or other dependency paths.

## Risk assessment

- **Positive**: no direct EXECUTE by `anon` or `authenticated`; capture routine is invoked by a scheduled privileged role; schema CREATE is denied to those public roles.
- **Residual**: `SECURITY DEFINER` has elevated authority; `search_path=public` merits hardening review. Exact body depends on upstream snapshot quality and immutable archive guarantees. Public broad grants on five audited relations (SECURITY-71) remain a separate unresolved issue. External RPC/Edge consumers and indirect invocation are not fully inventoried.
- **No exploit or data-write test** was performed in production.

## Next action

SECURITY-81: offline automated static guard for function EXECUTE and safe search_path expectations plus an isolated PostgreSQL staging rehearsal. Then complete authorized external/Edge consumer inventory before any grant migration. No production writes, GRANT/REVOKE, cron changes, deployment, merge or CORE 4.2 modifications. **Release NO-GO**.
