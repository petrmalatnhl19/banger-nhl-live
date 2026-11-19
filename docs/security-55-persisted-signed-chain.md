# SECURITY-55 — Persist signed synthetic evidence with four variants

A standalone offline test writes a complete synthetic source signature, separate witness signature, both public keys, frozen input, four outputs from the existing `calculateShadow` experimental function and hashes into a temporary SQLite archive. After reopening, it validates signatures, source/witness hash binding, cutoff, four deterministic coefficients and detects input, output, signature and late-witness tampering. CI runs the Python test and Node calculation.

**Trust limitation:** Both signing keys are locally generated and public keys are stored *inside the same archive*. Consequently an attacker who can replace the archive could replace keys and re-sign data; no independent key pinning, trusted timestamp authority, real-world publisher, immutable external archive, or actual CORE43-CAL-03 integration is established. This test demonstrates a persistent synthetic contract, not an externally authenticated NHL data chain.

No Supabase connections or writes, production CORE 4.2 changes, scheduled jobs, merge or deployment. Draft PR #274, **NO-GO**.
