# SECURITY-93 — Narrow public CORE 4.3 contract: design gate

17 November 2026 · Draft PR #274 · **NO-GO / design only**

## Baseline and why this stage exists

SECURITY-87 already rehearsed five-object revocation and exact ACL rollback in synthetic PostgreSQL 17. SECURITY-88 proved a browser regression: revoking public reads of `core43_shadow_predictions_v1` and `core43_shadow_preview_v1` replaces verified CORE 4.3 scores, previews and GSAx in TV Match Stats with dashes. SECURITY-90 therefore remains NO-GO. Do not repeat the same revocation as a production fix.

Read-only production catalog inspection on 17 November 2026 reconfirmed that `anon` and `authenticated` each have direct `postgres`-granted `arwdDxtm` privileges on `nhl_core43_shadow_inputs`, `core43_shadow_readiness_v1`, `core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, and `nhl_core42_status`. The first is an RLS-enabled table with no policies; TRUNCATE is not protected by RLS. The other four are views, whose listed TRUNCATE grants must not be confused with an executable TRUNCATE operation.

## Proposed separation (not yet implemented)

1. Inventory the exact browser requests, selected fields, fallback behavior, update cadence and authorized third-party consumers of the predictions and preview views. Record the current TV Match Stats field-to-render mapping and baseline screenshots for both public roles.
2. Define an explicit allowlist of **published** derived values required for TV Match Stats (verified score, preview, GSAx only if approved). Do not expose source snapshots, goalie identities beyond approved display fields, raw starter evidence, archive internals, or unrestricted rows. Verify each actual column before finalizing the allowlist; no new column names are asserted here.
3. Build a separate, versioned, minimal public read contract in an isolated environment. Prefer materialized sanitized publication through a tightly scoped, audited publisher; do not assume a `security_invoker` view can read RLS-protected private tables. If a privileged publishing routine is necessary, isolate its schema, revoke PUBLIC EXECUTE, constrain search_path and verify ownership and input validation.
4. Exercise `anon` and `authenticated` against the isolated gateway, not merely SQL. Assert approved public values match baseline and private columns/rows cannot be queried. Verify denial of INSERT/UPDATE/DELETE/TRUNCATE and that service/cron-equivalent collection and archive triggers still work.
5. Update the browser consumer only after the replacement contract passes. Prove no CORE 4.2 regression and no new dashes for CORE 4.3 / GSAx with synthetic browser tests and a representative end-to-end environment.
6. Capture normalized ACL/grantor/grantability snapshot and test exact post-commit restoration before authorizing any production revocation. Check managed API exposure, JWT roles, role inheritance, cache refresh, and external consumers.

## Release gates

- [ ] Exact public data allowlist approved and field lineage documented.
- [ ] Managed Data API exposure and consumer inventory confirmed.
- [ ] Isolated published contract implemented and least-privilege tested.
- [ ] Real browser requests and synthetic fixture show no display regression.
- [ ] Service/cron-equivalent collection and archive capture verified.
- [ ] Exact ACL rollback tested against a production-equivalent isolated gateway.
- [ ] All five CI jobs pass at the final commit; no production change until separate authorization.

**This document makes no SQL changes, does not approve release, and preserves Draft PR #274.**
