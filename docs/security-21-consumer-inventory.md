# SECURITY-21 — internal CORE43 consumer inventory (partial)

Status: **PARTIAL / NO-GO for production**. Read-only repository inspection, no deployment or production mutation.

## Target objects

- `public.core43_shadow_readiness_v1`
- `public.core43_shadow_predictions_v1`
- `public.core43_shadow_preview_v1`
- `public.nhl_core43_shadow_inputs`

## Verified findings

1. Fetched the full `index.html` on branch `security-01-public-grants-review` (549,183 characters). Case-insensitive literal search found **zero references** to any of the four object names. This is only a direct-string scan of one frontend file, not proof that runtime API calls or indirect consumers do not exist.
2. The `.github/workflows/security-grants-offline.yml` workflow does not contain any of these four object names; its tests may still refer to them in separate scripts.
3. GitHub code search on the default branch returned no matches for each object name. **Do not interpret this as repository-wide absence**: the search is default-branch-scoped and may not index all paths or Draft PR changes.
4. SECURITY-20 local PostgreSQL tests already exercise the four objects deliberately; these are test consumers, not evidence of production API usage.

## Not yet inspected / blockers

- Complete recursive repository file inventory on the Draft PR branch: all workflow YAML, Python/JS/TS, SQL, shell scripts, and documentation; inspect both literal references and indirect RPC/API access.
- Supabase Edge Functions, cron jobs, stored procedures, database functions and scheduled automation; any consumers outside this repository.
- Actual frontend network requests and role/JWT combinations (anon, authenticated, service_role).
- External mobile clients, third-party integrations, historic deployed versions, and rollback compatibility.

## Recommended next tests

1. Obtain a complete branch tree via GitHub API or local checkout; scan source files and workflow scripts. Exclude documentation-only matches from runtime-consumer conclusions.
2. Inspect Supabase function metadata and scheduled-job definitions with **SELECT only** and redact credentials.
3. Exercise public API and service-role consumers in isolated staging with synthetic data, then test before/after revocation.
4. Keep SECURITY-17 production NO-GO until the inventory and integration tests are complete and explicitly approved.

No merge, deploy, production SQL changes, or CORE 4.2 changes were performed.
