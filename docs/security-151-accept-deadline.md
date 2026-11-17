# SECURITY-151 — Offline accept-time deadline and queue saturation

A new offline server wraps SECURITY-149 with an admission timestamp captured immediately after `accept()`. The timestamp travels with the connection through SECURITY-146's bounded queue. The worker drops connections whose lifetime has already expired, and the integrated handler uses the original accept timestamp instead of resetting the deadline when processing starts. Full pending queues close excess sockets immediately; counters record accepted, overflow, expired-before-processing, and processed connections.

The offline regression uses real Linux Unix domain sockets, one worker, one pending slot and four concurrent client connections, verifying overload rejection and bounded drain. It also directly verifies expired accepted connections cannot reach SQLite and rejects out-of-range worker, queue and lifetime settings. Existing SECURITY-149 tests continue to exercise signed transactions.

## Remaining limitations — production NO-GO

- Deadline starts **after** the kernel returns `accept()`, not when a peer connects or enters the kernel backlog. Listener backlog delay is outside this bound.
- The queue remains bounded, but scheduling, process cleanup and OS socket close can extend observed wall-clock runtime past the deadline. Metrics are test-only and not persistent.
- Saturation test does not simulate valid signed requests under overload or fairness across multiple UIDs; UID gate and socket permissions require further review.
- This is a separate offline server, not wired into any production listener or deployment. Same-UID SQLite bypass, ambiguous commit, and OS-level process isolation remain production blockers.
- No Supabase changes, no production migrations, no merge, no deployment.
