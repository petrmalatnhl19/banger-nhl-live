# SECURITY-122 — read-only live public API readiness audit

Date: 2026-11-17. Scope: Supabase project `xxwqeiuyislnoxsmjuul`, public schema, read-only catalog queries. No DDL, GRANT, API key, endpoint deployment or production UI changes.

## Verified catalog facts
- `public.core43_shadow_predictions_v1` and `public.core43_shadow_preview_v1` are views with SELECT privileges for `anon` and `authenticated`.
- `public.nhl_core43_public_schedule_evidence` is also a view with SELECT for both roles.
- `public.nhl_prediction_archive` is an RLS-enabled table with SELECT privileges for both roles; the effective rows still depend on policies.
- `public.nhl_core43_shadow_capture_archive` is RLS-enabled and does not grant SELECT to either role.
- The shadow predictions view includes CORE 4.2 and CORE 4.3 values; preview values are in a separate view. The approved nine-field browser reader cannot use either existing view as-is: it requests all nine columns from one endpoint. Neither view alone provides all nine.
- Existing view schemas also include extra fields (such as experiment/model status and timestamps). Direct public exposure is not equivalent to an approved narrow public contract.
- The SECURITY-118 snapshot gate requires explicit version and freshness timestamps for both metadata and predictions. The reviewed view schemas do not implement the proposed combined versioned snapshot contract.
- `security113-tv-public-browser.js` requires an approved HTTPS endpoint and a publishable key. No endpoint/key is configured in production by SECURITY-121.

## Release blockers
1. Define and review a narrow, read-only public endpoint with only approved fields and a stable snapshot contract. Avoid granting more privileges to legacy/archive/shadow relations.
2. Audit view definitions, underlying relations, `security_invoker` behavior, RLS policies, role grants and exposed-schema configuration before publishing any endpoint.
3. Demonstrate complete metadata, CORE 4.2, CORE 4.3 and preview availability, including timestamps, matching game IDs and non-null rules. A catalog column alone does not prove actual data completeness.
4. Verify the endpoint using an explicitly approved publishable key and safe read-only GET requests in a separate authorized step. No live HTTP call or end-to-end API availability claim was made here.
5. Retain legacy-by-default, fail-closed preview and existing regression checks; require explicit rollout approval.

## Decision
**NOT READY for production switch-over.** This is a read-only schema/privilege discovery, not a live API validation or authorization to publish new data. Continue with a narrow contract and security-invoker/RLS audit before any production change.
