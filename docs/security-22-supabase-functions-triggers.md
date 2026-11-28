# SECURITY-22 — Supabase CORE43 function and trigger consumer audit

Read-only production catalog inspection, 2026-11-16. Project `app-development` only. **No production writes, DDL, deployments or merges.**

## Verified internal consumers

| Object | Type | Owner/security | Access and behavior |
| --- | --- | --- | --- |
| `public.capture_core43_shadow_inputs()` | integer-returning PL/pgSQL function | postgres, SECURITY DEFINER, search_path=public | Reads archive, goalie snapshots and starter evidence; inserts into `nhl_core43_shadow_inputs` with `ON CONFLICT (game_id,side) DO NOTHING` |
| `public.core43_capture_on_core42_insert()` | trigger function | postgres, SECURITY DEFINER, search_path=public | On `core42_predicted_at` NULL-to-non-NULL transition, invokes `capture_core43_shadow_inputs()` |
| `core43_shadow_on_core42` | enabled trigger (`tgenabled='O'`) | on `public.nhl_prediction_archive` | Calls `core43_capture_on_core42_insert()` |

## EXECUTE privilege baseline

- `anon`: EXECUTE false on both functions.
- `authenticated`: EXECUTE false on both functions.
- `service_role`: EXECUTE true on both functions.

This is a catalog privilege check, not an API integration test. The trigger can execute as part of an archive change without direct client EXECUTE privilege; the SECURITY DEFINER functions use owner privileges. The SECURITY-06 candidate explicitly revokes grants on the internal *table/views*, not these functions. It should not block their owner-privileged writes, **but this remains unverified in the isolated fixture**.

## Important remaining risks

- The fixture currently does not reproduce these functions or trigger. Add synthetic owner-privileged function/trigger behavior and assert capture still works after the local GRANT/REVOKE proposal.
- `search_path=public` and SECURITY DEFINER require independent hardening review (object shadowing, schema CREATE privileges and qualified identifiers). Do not change production function security settings without separate review and compatibility tests.
- Check scheduled jobs, edge functions, external API consumers and all Draft PR branch source files before claiming a complete consumer inventory.
- Recheck owner and EXECUTE grants before any future rollout; verify archive triggers and CORE 4.2 production behavior remain unchanged.

**Decision: NO-GO for production.** Draft PR #274 only.
