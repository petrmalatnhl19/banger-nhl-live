# SECURITY-27 — role-level negative access tests

Synthetic Docker PostgreSQL only. No production writes, deploys or merges.

## Added to security/local/verify.sh

For both `anon` and `authenticated`:
- Assert no UPDATE privilege on `public.nhl_prediction_archive` and no INSERT privilege on `public.nhl_core43_shadow_inputs`.
- Assert no EXECUTE on either SECURITY DEFINER function.
- Execute actual `SET ROLE` SQL attempts to UPDATE the archive, INSERT shadow inputs, invoke the capture function, and invoke the trigger function; each attempt must fail.
- Assert permitted SELECT on the synthetic archive still succeeds.

Also assert service_role retains EXECUTE on both functions, no forbidden shadow record was created, and the prior trigger capture remains exactly two rows.

## Boundaries

These tests verify only the isolated fixture and the named role/object combinations; they do not assert that production grants match the fixture. Production still has the broad grants identified in SECURITY-01 and remains **NO-GO** until an explicitly approved remediation is applied and independently validated. Draft PR #274 remains unmerged.
