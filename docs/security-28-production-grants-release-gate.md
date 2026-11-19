# SECURITY-28 — production privilege recheck and release gate

Date: 2026-11-16. **READ ONLY** production catalog inspection of Supabase `app-development` (`xxwqeiuyislnoxsmjuul`). No production DDL or writes.

## Verified current effective privileges

For both `anon` and `authenticated`:

| Public object | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `nhl_core43_shadow_inputs` | yes | yes | yes | yes |
| `core43_shadow_readiness_v1` | yes | yes | yes | yes |
| `core43_shadow_predictions_v1` | yes | yes | yes | yes |
| `core43_shadow_preview_v1` | yes | yes | yes | yes |
| `nhl_core42_status` | yes | yes | yes | yes |
| `nhl_prediction_archive` | yes | no | no | no |

These are catalog-level privilege checks; actual writes can also be constrained by RLS, view updatability, triggers, etc. The production `nhl_core43_shadow_inputs` table is RLS-enabled with no policies, per prior read-only inspection.

`service_role` has SELECT/INSERT/UPDATE/DELETE on all six inspected objects. Existing SECURITY-22 and SECURITY-24 inspections found only `postgres` and `service_role` with EXECUTE on the two CORE43 SECURITY DEFINER functions, and no CREATE on schema `public` for API roles.

## Interpretation and gate

- SECURITY-23 through SECURITY-27 passing in **synthetic** PostgreSQL does not demonstrate production remediation. Production grants are unchanged and overly broad.
- SECURITY-06 proposes a narrowly scoped revocation but is **not approved or applied**.
- Consumer inventory is incomplete, including possible external consumers; do not revoke SELECT on CORE43 views until that dependency question is resolved.
- **NO-GO for production**. Do not merge Draft PR #274, run migration, alter CORE 4.2 or deploy.

## Before any approval

1. Complete repository-wide and external consumer inventory for the three internal CORE43 views and shadow inputs.
2. Compare production role/policy/view behavior to the isolated fixture; document actual API compatibility for public status, schedule and analytics.
3. Prepare an explicit, tested rollback script and permission diff; independently review least-privilege grants.
4. Obtain explicit approval for any production migration and schedule controlled verification.

Next candidate: SECURITY-29 — complete consumer inventory and compatibility matrix, without production changes.
