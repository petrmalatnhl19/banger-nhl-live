# SECURITY-90 — Production readiness package

17 November 2026 · Draft PR #274 · **NO-GO**

The current revocation candidate breaks public CORE 4.3 values in TV Match Stats. Managed API settings, external dependencies and production-equivalent rollback still need evidence. This file records a conditional proposal only.

## Exact candidate for later isolated validation

The statements below match the scope tested in `security/local/security87-revocation.sql`. A separate application change and isolated end-to-end validation must precede production use.

```sql
BEGIN;
REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs,
  public.core43_shadow_readiness_v1, public.core43_shadow_predictions_v1,
  public.core43_shadow_preview_v1
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.nhl_core42_status
  FROM PUBLIC, anon, authenticated;
-- Run the preapproved read-only catalog assertions before COMMIT.
-- ROLLBACK if any assertion fails.
```

- Shadow inputs are internal. Remove all direct public grants, including TRUNCATE. Keep RLS and the owner and service grants.
- Readiness projects private goalie/starter state. Remove public access only after confirming its consumer contract.
- Predictions and preview are owner-rights views exposing derived shadow input values. Plan a narrower public contract for values the product intentionally publishes, switch the frontend, and verify equivalence and data minimization before restricting access.
- CORE 4.2 status is a public read dependency. Preserve both SELECT grants and remove the other seven rights, including PostgreSQL 17 MAINTAIN which the earlier SECURITY-06 list omitted.
- Keep archive, schedule evidence and the three model analytics views outside this change. Perform function search-path work separately.

## Before a separately authorized release

- [ ] Verify the exact approved commit, all five individual CI jobs, and synthetic browser, role, trigger and rollback evidence.
- [ ] Inventory the managed Data API configuration, exposed schemas, role inheritance, column grants, RLS policies, view projections, Edge authorization and cron execution identities.
- [ ] Confirm external consumers or measure the impact from authorized metadata. Preserve rendered public TV Match Stats values with a tested narrower contract.
- [ ] Rehearse using isolated Supabase gateway configuration and synthetic data. Exercise both public roles, service/cron-equivalent capture, archive-trigger capture, protected public endpoints and representative application flows.
- [ ] Snapshot normalized ACL entries for all five objects, including grantor, grantee, grantability, inherited and column access. Verify the grantor and restore capability. Materialize the exact rollback from that snapshot, test it after a committed rehearsal, and compare normalized effective privileges and grant entries.
- [ ] Confirm the live ACL snapshot still matches the approved baseline immediately before the change. Stop on drift or absent evidence.

## Staged application and checks

After the UI contract is migrated and verified, run the candidate as the authorized grantor in one transaction under a bounded lock budget. Compare pre-commit ACLs to the intended delta. Verify loss of public rights on four internal objects, SELECT-only access to status, preservation of owner/service permissions and preservation of protected public endpoints. Roll back the transaction on unexpected results. Commit requires separately authorized execution and passing gates.

- [ ] Confirm catalog state and managed API schema/cache behavior after commit.
- [ ] Verify expected public reads, denied internal reads and preserved TV status and scores using the approved release checks.
- [ ] Observe scheduled collection, capture and finalization through existing read-only monitoring. Verify timestamps, freshness and no increase in authorization errors.
- [ ] Compare the public application health signals and observed CORE 4.2 results with the baseline. Revert immediately for material regressions or missing evidence.

## Rollback

Before commit, issue `ROLLBACK`. After commit, use the prevalidated exact GRANT delta from the captured ACLs as the original grantor. At the observed snapshot, affected public-role entries originate from `postgres` without grant option. Restore SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN for the four internal objects, and only the seven removed non-SELECT rights for status if the approved snapshot still shows precisely those entries. Restore a different observed grantor or grant option only from validated snapshot evidence. Verify normalized equality as well as effective SQL/API access and application recovery. Treat re-exposure of internal views during rollback as a release risk. No production rollback bundle has been executed or qualified against the managed API.

See SECURITY-85 through SECURITY-88 for passing local evidence and remaining coverage, and SECURITY-89 for open risks. **Decision remains NO-GO.**
