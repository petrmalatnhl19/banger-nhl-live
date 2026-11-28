# SECURITY-63 — Archive bound to signed checkpoint history

The standalone offline Node test binds a synthetic four-variant experimental CORE 4.3 `calculateShadow` archive to a signed machine-checkpoint chain. The final checkpoint records the exact archive hash and the signed registry hash. A separately stored synthetic head anchor prevents accepting truncated, reordered, or alternate signed histories. After reopening local files, the test checks the publisher and observer signatures, cutoff, four deterministic variants, and the complete checkpoint chain.

Negative cases cover missing/reordered history, deleted tail, modified archive, alternate validly signed fork, and forged machine signature.

**Limitations:** The earlier checkpoint contains a synthetic historical archive hash, not a real archived prediction. The registry, machine witness, and head anchor are local CI fixtures with ephemeral keys, not independently operated or tamper-resistant infrastructure. The history chain and archive validation are integrated within this offline test, not into production or the real CAL-03 pipeline. An adversary controlling the machine's anchor storage and signing keys remains out of scope.

No Supabase writes, production CORE 4.2 modifications, merges, schedules or deployment. Draft PR #274; **NO-GO**.
