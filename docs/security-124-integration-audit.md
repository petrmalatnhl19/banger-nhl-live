# SECURITY-124 — Integration audit: NO-GO

Scope: offline review of SECURITY-120 through SECURITY-123, on Draft PR #274. No production deployment, database grant change, or merge.

## Verified boundaries
- `index.html` still loads `scripts/banger_tv_match_stats.js`, not SECURITY-120/121/123 modules.
- The live TV script still queries `nhl_prediction_archive`, `core43_shadow_predictions_v1`, and `core43_shadow_preview_v1`.
- SECURITY-120 defaults to legacy and requires explicit `public-preview` mode; its output is a field allowlist.
- SECURITY-121 defaults to disabled and reads through the reviewed browser reader only when explicitly enabled; failures do not fall back to legacy reads.
- SECURITY-123 prepares a narrow, nine-field prediction contract and validated metadata offline. It does not deploy an endpoint or change privileges.
- SECURITY-118 freshness timestamps are supplied as inputs, not authenticated by the browser reader or a deployed server. The proposed five-minute freshness policy is not a production-approved guarantee.
- The replacement public endpoint and its real production role/RLS behavior remain unverified. The existing browser script still depends on legacy access.

## Release decision
**NO-GO** for revoking production grants, switching the public UI, or merging this security PR. The four existing CI workflows do not constitute approval to deploy.

## Follow-up gates
1. Approve field classification and timestamp provenance, including explicit game eligibility.
2. Establish a reviewed, production-compatible read-only endpoint and verify actual RLS/role access.
3. Add an explicit disabled-by-default client migration and real browser integration tests.
4. Complete observability, production read-only preflight, approval, rollback rehearsal and post-change checks from SECURITY-100.

The new SECURITY-124 regression guard protects this current separation until an explicitly reviewed migration changes it.
