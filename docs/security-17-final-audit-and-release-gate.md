# SECURITY-17 — final read-only audit and release gate

Status: **NOT APPROVED FOR PRODUCTION**. Draft PR #274 only. No production SQL executed.

## Read-only production catalog baseline (2026-11-16)

Checked `pg_class`, `pg_roles`, `has_table_privilege` for `anon`, `authenticated`, `service_role` in Supabase `app-development` (`xxwqeiuyislnoxsmjuul`). These are catalog privilege checks, **not** API or RLS execution tests.

- `anon` and `authenticated`: SELECT/INSERT/UPDATE/DELETE all report **true** on `nhl_core43_shadow_inputs`, `core43_shadow_readiness_v1`, `core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, `nhl_core42_status`, and all three `nhl_core_model_*` views.
- `anon` and `authenticated`: SELECT true, INSERT/UPDATE/DELETE false on `nhl_prediction_archive` and `nhl_core43_public_schedule_evidence`.
- `service_role`: SELECT/INSERT/UPDATE/DELETE true on all ten examined objects.
- All examined views except `nhl_core43_public_schedule_evidence` have `reloptions=NULL`; the schedule view has `security_barrier=true`. **security_barrier is not security_invoker**. Treat the view ownership/RLS implications as unresolved until reviewed.
- These grants are not proof that writes through views or RLS-protected tables succeed.

## Synthetic fixture coverage and fidelity

- Exact production SQL was reproduced for `nhl_core42_status`, `nhl_core43_public_schedule_evidence` and three analytics views: `nhl_core_model_accuracy`, `nhl_core_model_head_to_head`, `nhl_core_model_trend`.
- `core43_shadow_predictions_v1`, `core43_shadow_preview_v1`, `core43_shadow_readiness_v1` are **production-inspired approximations, NOT exact production SQL**. The readiness fixture models lateral joins, time cutoffs, missing IDs, evidence status and shot counts; this does not establish behavioral equivalence.
- Fixture uses PostgreSQL 17, synthetic data and synthetic roles. It does not reproduce Supabase Data API, JWT/RLS policies, role inheritance, edge functions, production schema indexes, or actual consumer behavior.
- SECURITY-15 covers six negative readiness cases and SECURITY-16 covers synthetic aggregate results; this is meaningful but limited offline evidence.
- Local fixture `nhl_core43_public_schedule_evidence` currently omits production `security_barrier=true` reloption. Fix before claiming schema-equivalence.
- Local synthetic `nhl_prediction_archive` RLS policy permits public SELECT and is not a verified production policy mirror.

## SECURITY-06 candidate: expected impact

1. Remove public grants on `nhl_core43_shadow_inputs` and the three internal CORE43 views.
2. Remove excess write grants on `nhl_core42_status`, keep SELECT.
3. Preserve public SELECT on `nhl_core43_public_schedule_evidence`, the three model aggregate views and `nhl_prediction_archive`.
4. Do not revoke `service_role` explicitly. Verify its actual access path, not merely grants.
5. These changes do **not** by themselves eliminate Supabase SECURITY DEFINER view advisories.

## Mandatory blockers before production approval

- Inventory frontend, GitHub Actions, edge functions, scheduled jobs, and any external clients using the three internal views with `anon` or `authenticated`. Direct-string absence in one frontend file is insufficient.
- Compare **exact** production view definitions and column types for the three approximated CORE43 views; test the exact SQL in an isolated equivalent schema and fix the schedule view's `security_barrier` discrepancy.
- Capture real production policies, default privileges, ownership and inherited grants; verify `anon`/`authenticated` actual SELECT and attempted writes, including the API and RLS behavior.
- Run pre/post compatibility tests on isolated staging for anonymous, authenticated, service-role, frontend and background consumers; test rollback.
- Capture a fresh production read-only baseline immediately before any future change; stop if schema or grants drift.
- Obtain explicit approval for the exact SQL and a separate production execution plan. **Do not apply the proposed SQL automatically.**

## Decision

**NO-GO for production migration.** Offline permission tests pass, but view fidelity and consumer compatibility remain incomplete. Keep PR #274 Draft; do not merge, deploy or modify production CORE 4.2.
