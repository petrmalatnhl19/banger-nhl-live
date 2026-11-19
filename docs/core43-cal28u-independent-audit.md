# CAL-28U — independent signed audit (offline fixture)

CAL-28U verifies a second Ed25519 signature from a distinct audit identity over the exact JSON snapshot hash, object version, store ID, digest and constrained synthetic finding. It first validates the CAL-28S signed receipt and CAL-28T metadata. Eight regression tests cover valid synthetic input, metadata modification, digest binding, wrong key, forged finding, reused auditor identity, extra trust fields and tampered signature.

The audit is **not** evidence of real provider enforcement: auditor identities and keys are synthetic, and the provider metadata is caller-supplied. The result always contains `trusted:false`. It does not query external storage, validate real IAM permissions, prove WORM compliance or establish independent host custody. It does not participate in production pin advancement. Future integration requires independently authenticated provider responses, out-of-band auditor key trust, signed policy provenance, version-specific retention checks and real negative permission tests.

Scope: Draft PR #230 only. No Supabase writes, CORE 4.2 modifications, live dry-run, merge or deployment.
