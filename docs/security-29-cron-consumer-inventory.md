# SECURITY-29 — production CORE43 consumer inventory, database and cron slice

Date: 2026-11-16. Production Supabase `app-development`, **read-only** inspection. No production writes or configuration changes.

## Repository inspection scope

- PR #274 changed-file inventory contains 22 security-related files (tests, workflows, docs, fixture), not a complete repository tree.
- SECURITY-21 already scanned the full Draft-branch `index.html` for four exact object names with zero literal hits. This does **not** prove there are no indirect API/RPC calls.
- The repository-wide source inventory is still incomplete; no claim of complete frontend or external consumer coverage.

## Production database findings

- Read-only scan of non-system `pg_proc.prosrc` for literal names `core43_shadow_readiness_v1`, `core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, and `nhl_core43_shadow_inputs` found one matching routine: `public.capture_core43_shadow_inputs` (`SECURITY DEFINER`). This is a direct literal dependency inventory, not full dependency analysis.
- `pg_cron` is installed; `cron.job` exists. Four jobs are active:
  - Job 3 `banger-nhl-collect`: `15 */2 * * *`.
  - Job 4 `banger-nhl-finalize`: `35 * * * *`.
  - Job 5 `banger-core43-shadow-capture`: `25 */2 * * *`, command text references `capture_core43_shadow_inputs`.
  - Job 6 `banger-core43-starter-evidence`: `*/10 * * * *`.
- No cron command directly references the four target internal object names; one command references the capture/trigger function names. Cron command bodies are intentionally **not copied** to avoid disclosing potential credentials.

## Compatibility and release gate

- SECURITY-06 proposed grant revocations are **not applied**. In particular, ensure the active shadow-capture cron path and trigger still function with proposed restrictions.
- Existing SECURITY-23–27 synthetic tests cover privileged capture, trigger, deduplication, and role denials, but do not prove production cron role identity or external consumer compatibility.
- **NO-GO** for production; keep PR #274 Draft, do not merge or deploy.

## Outstanding blockers

1. Complete full branch source tree scan, including workflow and server/Edge code, with literal and indirect Supabase API/RPC usage.
2. Audit the actual role/security context of cron job 5 without exposing command secrets; verify function EXECUTE permissions for that role.
3. Inspect Edge Functions and external/mobile clients, plus real API compatibility before any revocation.
4. Independently review proposed permission diff and rollback, then seek explicit production approval.
