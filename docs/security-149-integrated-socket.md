# SECURITY-149 — Offline integrated signed socket

Integrates SECURITY-146 fixed worker pool, bounded pending queue, per-UID gate and absolute framed-read deadline with SECURITY-147's subprocess lifetime concept and SECURITY-148's signed SQLite idempotency receipts. The isolated Python child receives the request over stdin and returns a single status on stdout. The parent sends `{"operation":"submit|reconcile","request":{...}}` over an authenticated Unix socket and responds with `{"status":"committed|replayed|rejected|unknown"}`.

`unknown` is **not** proof of rollback: a commit may have completed before timeout or lost acknowledgement. Reconciliation verifies the original signed envelope and checks the atomic receipt. Never retry with a new request ID until status has been reconciled. The integration regression tests signed submit, replay, reconciliation, tampering, subprocess timeout, recovery, concurrency and trickle-read expiry.

## Security limitations / NO-GO

Offline prototype only. Child process uses a fresh interpreter and is killed on timeout, but this does not establish an absolute deadline for OS process termination, descendants, or filesystem durability. The `Server` inherits SECURITY-146's bounded queue but queue admission time is **not** included in the per-request deadline. The child process inherits the server's OS UID, so the same-UID SQLite bypass remains; trust data is transmitted over a local stdin pipe, not a hardened IPC channel. Receipt reconciliation can return `unknown` for a missing record or database error. `rejected` is also used for lock failures; production requires finer error semantics. Socket framing and UID authentication rely on Linux SO_PEERCRED. No real listener deployment, daemon installation, production migrations, Supabase access or CI secrets.

The implementation intentionally remains independent of SECURITY-147's multiprocessing API to avoid dynamic-module spawn pickling; it applies the same bounded subprocess lifetime using subprocess.Popen. Do not merge/deploy without separate review and production integration.
