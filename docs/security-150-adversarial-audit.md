# SECURITY-150 — Offline adversarial review of integrated socket receipts

## Scope and observed issues
Reviewed SECURITY-149 integration of SECURITY-146 bounded worker pool, SECURITY-147-style subprocess timeout and SECURITY-148 signed SQLite receipts. The SECURITY-148 verifier previously checked only whether the requested scope existed in the signed checkpoint heads, without verifying that its head equaled the requested epoch. SECURITY-150 now rejects mismatched signed heads. The subprocess deadline previously killed only the direct interpreter; SECURITY-150 uses the child session/process group for timeout termination on POSIX.

## Regression cases
The SECURITY-150 GitHub Actions step checks invalid Ed25519 signatures, rejected Unix peer UID, malformed operations, a validly signed checkpoint with a mismatched scope head, commit/replay/reconcile, artificial child timeout, retry after timeout, client disconnect after commit before response, concurrent socket submissions, SQLite lock and subsequent recovery, and worker/queue configuration caps.

## Remaining NO-GO / risk register
- This is an offline-only prototype, not production deployment. No Supabase writes.
- The process-group kill is Linux/POSIX-specific and can still exceed the nominal deadline during OS cleanup. External OpenSSL verification subprocesses may be terminated by group kill; a hard guarantee requires stronger supervision.
- Per-connection deadline begins only after worker queue admission, not on accept. Saturation behavior of a live listener is not fully exercised by this regression; queue admission and fairness remain future audit work.
- `unknown` cannot be interpreted as proof of no commit; only signed reconciliation may establish a durable receipt. The test covers client disconnect after commit, but does not deterministically inject a delay between SQLite commit and the subprocess response.
- The SQLite schema, OS UID isolation, cryptographic trust provisioning, and socket protocol are not production-hardened. Same-UID direct SQLite writes remain possible. Error codes do not distinguish lock contention from invalid signed requests.
- No production migration, daemon startup, deployment, Supabase modification, merge or secret handling was performed.

## Exit criteria
Require all CI checks green, a dedicated saturation/accept-deadline test, a deterministic post-commit pre-ACK fault-injection test, and independent security review before any production consideration.
