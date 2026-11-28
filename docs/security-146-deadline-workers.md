# SECURITY-146 — Absolute read deadline and bounded offline workers

This Linux-only offline prototype extends SECURITY-145 with a monotonic **total receive deadline** (0.8 seconds) independent of the idle socket timeout. Every receive uses the lesser of the remaining total budget and the idle timeout; slow trickle traffic is rejected. The 16 KiB frame bound, SO_PEERCRED UID allowlist, per-UID rate gate and signed SECURITY-140 SQLite transaction remain in force.

A fixed pool of at most two worker threads and a queue of at most two pending connections provides bounded application-side concurrency. Queue overflow closes the incoming connection. The regression tests a trickle client exceeding the total deadline, a valid signed request, and invalid pool configurations.

**Not production ready:** Deadline covers reading only, not JSON parsing, OpenSSL signature verification, SQLite lock waits, or response sending. An accepted connection can wait in the queue before its read deadline begins. The OS listen backlog is separate. This prototype does not provide graceful shutdown under a stuck worker, independent process isolation, fairness, durable rate limits, or resource budgets for cryptographic work. Same-UID file access remains a bypass. No production server deployment.

No Supabase or production CORE/grants changes. PR #274 remains Draft, unmerged and undeployed.
