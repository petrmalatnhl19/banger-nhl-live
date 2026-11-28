# SECURITY-60 — Independent synthetic checkpoint witness

Offline test `scripts/test_security60_independent_checkpoint.cjs` uses two separately generated Ed25519 identities: registry signing root and checkpoint witness. A local registry and local checkpoint are compared to a signed witness checkpoint stored in a separate synthetic directory. Rolling back both local records to a previously valid signed version must fail because the separately held witness still confirms the newer registry hash/version. The test also rejects forged registry or witness signatures.

**Threat-model limits:** Both directories and private keys are created on the same CI machine. The 'external' witness is a simulated trust boundary, **not** an independently operated service, trusted timestamp, public transparency log, or tamper-resistant monotonic checkpoint. If the witness storage is rolled back with the local files, or the witness key is compromised, the check can be bypassed. The test does not yet wire this witness into the SECURITY-59 archive reader. Real-world witness authentication, availability and fork detection remain open.

No production Supabase/CORE changes, schedules, merge or deployment. Draft PR #274; **NO-GO**.
