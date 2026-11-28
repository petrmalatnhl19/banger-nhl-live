# SECURITY-62 — Signed checkpoint history and synthetic retained anchor

Offline test `scripts/test_security62_checkpoint_history.cjs` verifies a signed three-entry machine-checkpoint hash chain against a separately stored latest-head anchor. It rejects deletion of the tail, removal of a middle entry, reordered entries, modified signed content, attacker-signed replacements, and an alternative validly signed fork whose head differs from the retained anchor.

No human approval or witness is required. The retained anchor is a **synthetic local file** in CI, not truly independent or tamper-resistant storage. An adversary able to alter both the history and anchor could bypass the check. The test is not yet integrated with the SECURITY-61 archive verification and does not provide actual external timestamping, real publisher authentication, durable append-only service, or production access controls.

No Supabase/production CORE 4.2 changes, no deployment or merge. Draft PR #274, **NO-GO**.
