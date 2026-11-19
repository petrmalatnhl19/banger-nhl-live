# SECURITY-148 — Offline idempotent signed transaction receipts

The new offline owner stores a signed-envelope digest, caller request ID, scope, epoch and committed receipt in **the same SQLite transaction** as the latest checkpoint. A replay of the identical verified signed envelope returns `replayed` without advancing the epoch. Reusing an ID with different signed contents is rejected. The `reconcile` operation verifies the complete signed envelope again before returning `committed`, `unknown` or `rejected`; a client-supplied ID alone is insufficient.

Adversarial CI covers commit-before-ack failure injection, 8 concurrent retries, replay, signed ID collision, tampered request, SQLite lock and recovery. The receipt is durable after a successful commit and can be queried after a lost response.

**Production NO-GO:** This is a separate offline proof of concept, not yet integrated with SECURITY-147 child process lifecycle or SECURITY-146 Unix socket service. A request_id is client-provided and not independently covered by the Ed25519 signed checkpoint/anchor payload; binding to the signed envelope digest prevents an altered signed envelope from claiming a receipt, but a new request_id with identical signed payload is still distinguishable and is rejected by epoch sequencing after commit. An authenticated status response requires channel authentication in a real service. No cross-process crash simulation or production migrations are included. An `unknown` status can reflect missing schema or database errors and must not be interpreted as proof of non-commit. SQLite connection timeout is 1s and is not yet tied to SECURITY-147 deadline. Same-UID database bypass remains.

No Supabase or production modifications. Keep PR #274 Draft and do not merge or deploy.
