# SECURITY-07 — dependency and staging test gate

Date: 2026-11-16. Read-only audit; **no production SQL was executed**.

## Verified

- Current GitHub workflow `.github/workflows/frontend-smoke.yml` has two jobs, `frontend-smoke` and `browser-smoke`. It does **not** contain Supabase/SQL security or role-authorization tests.
- Production PostgreSQL catalog confirms `core43_shadow_predictions_v1` and `core43_shadow_preview_v1` directly depend on `nhl_core43_shadow_inputs`.
- No other direct view-to-view dependents were found in `public` for the three experimental views in this catalog query. This **does not** cover functions, edge functions, external API consumers or application scripts.
- A direct search in the main branch `index.html` did not find the five target object names. This does **not** establish that all code or clients are unaffected.

## Proposed staging tests (do not run against production)

1. Clone equivalent schema and policies to isolated staging with non-sensitive fixtures.
2. Capture grants and query behavior for `anon`, `authenticated`, and `service_role`.
3. Apply reviewed SECURITY-06 candidate SQL **only on staging**.
4. Assert public roles cannot SELECT from three internal experiment views and cannot directly access `nhl_core43_shadow_inputs`.
5. Assert public roles can still SELECT intended schedule, CORE 4.2 status, model accuracy, head-to-head and trend views.
6. Check all relevant frontend routes and automation consumers; verify no permissions regressions.
7. Capture rollback SQL from baseline grants, confirm a rollback rehearsal in staging.
8. Review SECURITY DEFINER advisor warnings separately; revoking public SELECT does not automatically eliminate those findings.
9. Do not schedule or apply production migration without explicit approval and completed staging verification.

## Important distinction

Passing `frontend-smoke` and `browser-smoke` verifies web functionality in those jobs, **not** SQL privilege isolation or real Supabase anon/authenticated authorization.

## Current decision

SECURITY-06 is **not ready for production**. Keep PR #274 Draft. Next: comprehensive consumer inventory and staging environment approval.
