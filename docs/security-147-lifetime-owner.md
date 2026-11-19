# SECURITY-147 — Bounded signed transaction lifecycle (offline)

The prototype `security/local/security147-lifetime-owner.py` runs the SECURITY-140 signature validation and SQLite transaction in a **spawned child process**. A monotonic deadline covers socket receiving and waiting for child completion. A child exceeding the remaining time is terminated, then killed if necessary. This prevents a stuck OpenSSL subprocess or SQLite busy wait from holding the calling worker indefinitely in the tested scenarios. The original signature and SQLite transaction checks remain unchanged. SECURITY-146's worker pool is not wired to this prototype yet.

The CI regression exercises valid signed write, replay rejection, a synthetic stalled child, an independent SQLite write lock, recovery after timeout, and trickle receive. Timeouts do not intentionally commit data.

**Important safety limits / production NO-GO:** Termination of a child after the database commit does **not** undo an already completed commit; a timeout response can be ambiguous. The SQLite atomic transaction still prevents partial commits. Child process termination does not guarantee termination of all descendant subprocesses, and the parent does not enforce a process-group kill. The deadline starts after peer authentication and gate admission, not while waiting in the accept queue. Process startup, shutdown and socket response may add small bounded overhead. A dedicated idempotency/reconciliation protocol, total queue deadline, hard OS resource limits, isolation, and process-tree cleanup are required before production. Same-UID direct SQLite access remains a bypass.

No Supabase access, no production grants/CORE modifications, no merge or deployment. PR #274 remains Draft.
