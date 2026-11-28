# SECURITY-107 — final integration audit (read-only / NO-GO)

Scope: review of repository integration after synchronizing PR #274 with main. This document is **not** production approval and does not certify live Supabase state.

## Verified in repository
- `scripts/banger_tv_match_stats.js` still reads `nhl_prediction_archive`, `core43_shadow_predictions_v1` and `core43_shadow_preview_v1`. The replacement endpoint is **not deployed or wired into the frontend**.
- `security/local/security102-tv-adapter.cjs` maps a nine-field contract into TV shadow/preview records. This is offline code, not browser integration.
- `security/local/security103-tv-rollout.cjs` defaults to legacy, supports disabled/public modes and does not silently fall back from a failed public fetch to legacy.
- `security/local/security101-public-view.sql` and SECURITY-104 exercise an isolated PostgreSQL/PostgREST fixture, not the production schema.
- Frontend CI includes SECURITY-105 static TV contract and SECURITY-106 post-merge checks. These do not replace an end-to-end visual test of the production TV component.

## Release decision: NO-GO
The eight gates from SECURITY-100 remain mandatory. In particular:
1. Approve field-by-field data classification and source freshness/eligibility.
2. Review and implement a production-compatible least-privilege API with real RLS and exposed-schema checks.
3. Build an explicit disabled-by-default browser rollout and run isolated visual tests, including unavailable/null/stale cases.
4. Revalidate the live ACL/RLS and consumer inventory read-only immediately before an approved change window.
5. Define observability, rollback thresholds and rehearsed restoration; obtain explicit production authorization.

**Do not revoke production grants, merge PR #274 or deploy an API based on these synthetic results alone.**

## Regression guard
`node .github/scripts/test-security-107-integration-gate.cjs` asserts the repository's NO-GO conditions and required tests. It is intentionally static and cannot prove actual data confidentiality or live API availability.
