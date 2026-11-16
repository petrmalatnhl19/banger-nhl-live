# SECURITY-58 — Offline signed registry and anti-rollback checkpoint

A standalone synthetic Node test signs a trust registry using a separately pinned Ed25519 root public key, then checks an incrementing version, previous-registry hash, duplicate key IDs, revoked publisher key, and a separately stored minimum-version checkpoint. It rejects an older validly signed registry, an attacker-signed replacement, a broken hash chain, and duplicate IDs. The CI workflow runs the test.

**Limitations:** Root key and checkpoint are generated locally for the test. The checkpoint is a mutable local file, not protected monotonic hardware, transparency log, trusted timestamp, or independently audited witness. An attacker able to replace both registry and checkpoint could roll back the state; this test alone does not solve that threat. It is not yet wired into the SECURITY-57 archive reader, nor used with real publishers.

No production CORE 4.2, Supabase, deployment, merge or scheduled activation. Draft PR #274; **NO-GO**.
