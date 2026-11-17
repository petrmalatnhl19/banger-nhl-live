# SECURITY-145 — Offline bounded Unix socket writer

The SECURITY-145 prototype `security/local/security145-bounded-writer.py` builds on SECURITY-140/144: Linux SO_PEERCRED UID allowlist before parsing, signed checkpoint and anchor validation before transactional SQLite write, maximum request 16 KiB, 400 ms socket read timeout, process-local maximum two admitted requests and sliding one-second maximum three requests per UID. An explicit lock protects shared gate counters; release occurs in `finally`. Unauthorized, oversized, malformed, slow and over-limit requests fail closed.

The regression `.github/scripts/test-security-145-bounded-writer.py` exercises deterministic concurrency and rate windows, valid signed commit, oversized input, slow client and signed replay. It is run by the offline security GitHub Actions workflow.

**Production NO-GO:** This is a single-request-at-a-time test harness. A true bounded-concurrency server/worker pool, bounded accept queue, total request deadline (including OpenSSL/SQLite), fair scheduling, memory limits, persistent or shared rate accounting, metrics, audit log and robust handling of clients closing early are not implemented. The socket receive timeout is per blocking read, not a whole-message deadline; a client that continuously trickles data could hold a worker. Limits are not durable across restarts or shared across processes. Same-UID direct database access remains a concern. A rejected peer may receive EOF rather than structured JSON. Do not deploy.

No changes to Supabase, production grants or CORE; PR #274 stays Draft; no merge/deployment.
