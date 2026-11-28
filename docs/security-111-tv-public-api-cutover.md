# SECURITY-111 — TV Match Stats public API cutover specification (NO-GO)

Status: **design-only / production NO-GO**. This step does not deploy, revoke grants, or enable a feature flag.

## Verified starting point (2026-11-17)
- PR #274 remains Draft and mergeable at review time.
- `scripts/banger_tv_match_stats.js` still uses Supabase REST endpoints directly.
- `docs/security-100-staged-public-api-migration.md` records direct dependencies on `nhl_prediction_archive`, `core43_shadow_predictions_v1` and `core43_shadow_preview_v1`.
- SECURITY-95/96 describe a *proposed* nine-field contract; SECURITY-99 uses a synthetic table, not a production replacement.

## Implementation order
1. Inventory every query, selected field, filter and display mapping in the TV script. Record the exact old response shape before changing it.
2. Obtain explicit approval of each public field and its eligibility/freshness rules. Do not expose goalie evidence, internal identifiers, source records, operational flags or secrets.
3. Implement a **pure normalization adapter** that accepts only allowlisted public fields, rejects duplicates and non-finite numbers, distinguishes missing from zero, and yields a stable display model. Keep it independently unit-testable.
4. Implement an explicit **default-off** API selector. Only allow the new public endpoint when the reviewed endpoint exists and the flag is deliberately enabled. Do not silently fall back to internal shadow views on permission errors, malformed responses or outages in the new mode.
5. Preserve the current UI for CORE 4.2, CORE 4.3, GSAx, empty states and Czech error messages. Treat a denied response as unavailable rather than as a valid prediction.
6. Add isolated tests for both modes: expected field allowlist, anonymous/authenticated reads, no writes, malformed/null/Infinity values, duplicate games, stale data, timeouts, 401/403/5xx, no sensitive fields, no console leakage, and no silent legacy fallback.
7. Add a CI gate that fails if the new mode is enabled by default or if the adapter uses internal-only endpoints.
8. Before any production change, require real endpoint provisioning, a read-only preflight, a tested rollback, explicit approval and a separate release plan.

## Rollback boundary
Before grant revocation, rollback is disabling the new mode and restoring the prior TV frontend version. **After grant revocation, frontend rollback alone is insufficient**; restore permissions only via separately reviewed, approved SQL with verified prior ACL snapshot.

## Stop conditions
Unknown contract, missing production-equivalent API, failed tests, hidden legacy fallback, any internal data leak, missing rollback approval or any active direct consumer of soon-to-be-revoked objects.

## Decision
**NO-GO for production migration.** SECURITY-112 should implement the adapter and offline tests only after mapping the exact proposed contract to the existing frontend.