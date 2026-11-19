# CORE43-CAL-27 — security audit of CAL-18 through CAL-26

Status: **audit findings; no production authorization**. Scope: static review of the named modules, not penetration testing or operational validation. No live collection or database writes.

## Findings

| ID | Severity | Evidence | Required remediation |
| --- | --- | --- | --- |
| CAL27-01 | HIGH | `core43_cal25_audit.cjs` identifies locks, orphaned temporary files and symlinked pins, but `core43_cal24_pin.cjs` does not call `inspectPin` before advancing. A stale `.next-*` file or a symlinked receiver pin may be ignored by the writer. | Add fail-closed preflight under the writer lock, with no automatic stale-file cleanup; safely validate pin type and filesystem permissions. Ensure the writer's own lock is accounted for. |
| CAL27-02 | HIGH | `core43_cal18_verify.cjs` accepts `kind: independent` from a configuration field and reports `independentTsaProfile: true`; this does not establish independent real-world TSA operation, current revocation or official game start. | Require independently sourced TSA identity, policy/revocation checks and verified game start before any pilot claims. Rename the misleading success flag. |
| CAL27-03 | HIGH | `core43_cal22_transfer.cjs` and `core43_cal21_checkpoint.cjs` validate the hash chain and signature, but the transfer includes archive digests, not the archived evidence itself. `test_core43_cal26_end_to_end.cjs` uses arbitrary synthetic digest strings. | Verify availability and CAL-18B content integrity of every referenced archive before treating the transfer as full evidence validation. |
| CAL27-04 | MEDIUM | `core43_cal24_pin.cjs` accepts an approved head as a CLI argument. No independently authenticated operator-approval receipt is checked. | Define an externally controlled approval channel, signed receipt, replay/expiry rules and operator identity; do not infer independence from matching hashes. |
| CAL27-05 | MEDIUM | `core43_cal25_audit.cjs` checks shape and local filesystem artifacts but does not prove the pin matches a separately preserved, trusted checkpoint or archives. | Verify external trusted anchor, evidence completeness and retention before recovery authorization. |
| CAL27-06 | MEDIUM | CAL-24/25/26 tests simulate exceptions and single-runner file operations. | Rehearse real process exits and independent-host recovery; separately assess physical power-loss and filesystem durability. |

## Decision and gates

**NO-GO for real pilot or production CAL.** Existing green CI verifies synthetic behavior, not independent operational control. Remediate CAL27-01 and CAL27-03 first; require explicit independently operated TSA and approval provenance, read-only Supabase access authorization, and sufficient prospective paired forecast samples before any go/no-go reassessment.

Keep Draft PR #230 open. Do not merge, deploy, activate live dry-run, modify production CORE 4.2, or write to Supabase.
