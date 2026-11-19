# SECURITY-78 — Offline source consumer inventory (phase 1)

Date: 2026-11-17. Draft PR #274. **Production NO-GO**.

Added `.github/scripts/security78-consumer-inventory.py` to the existing offline grants workflow. It scans all tracked non-documentation text files (with binary/size exclusions), checks exact object identifier boundaries for five scoped production objects, prints matching filenames and counts, and writes a GitHub Actions step summary. It never uses database credentials, external API requests, or production writes.

Targets: `nhl_core43_shadow_inputs`, `core43_shadow_readiness_v1`, `core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, `nhl_core42_status`.

**Important:** This is a static source-reference inventory, not a complete consumer or runtime dependency graph. Matches can be tests/migrations, not active consumers; no matches do not prove no consumers. It does not enumerate deployed Edge Functions, Supabase cron job bodies, indirect RPC/view dependencies, generated dynamic SQL, clients outside this repository, or API traffic. Existing SECURITY-29/68 documentation describes some of those dependencies but is incomplete. The next phase should use read-only catalog and approved deployed runtime inventory and then isolated API compatibility checks. No public grant revocation is authorized.

During SECURITY-78 preflight, the previous SECURITY-77 PostgreSQL workflow failed on a malformed PL/pgSQL closing dollar delimiter in the SECURITY-69 test. Fixed on branch in commit `80b77ced9c093926255bd1434840223619d4f7dc` using a tagged delimiter; the latest commit's CI must still be checked. No production changes, deployment, merge, schedule activation or CORE 4.2 changes.
