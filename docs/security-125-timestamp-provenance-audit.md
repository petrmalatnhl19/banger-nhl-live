# SECURITY-125 — timestamp provenance review (NO-GO)

This milestone adds an **offline policy interface**, not cryptographic proof, a production verifier, or a deployed timestamp service.

## Findings
- SECURITY-118 checks canonical UTC timestamps, freshness and skew, but accepts supplied values without authenticating their source.
- SECURITY-123 validates timestamp syntax and exposes supplied timestamps; it does not establish origin or integrity.
- SECURITY-121 accepts timestamp inputs from its caller; its HTTPS public reader returns prediction fields but no authenticated timestamp envelope.
- A fresh-looking timestamp, `verified: true` flag, browser clock, or asserted source name does not establish authenticity.

## SECURITY-125 safeguard
`security/local/security125-timestamp-provenance.cjs` returns `unverified` and redacts timestamps by default. A separately supplied verifier must explicitly accept the exact timestamp pair and version together with evidence before it returns `verified`. The CI verifier is **synthetic only**; passing CI is not proof of a genuine signed timestamp.

## Required before production
1. Define an authoritative timestamp source, signed canonical envelope binding metadata, predictions, version, and immutable content digest.
2. Select a trusted signature verification implementation, key distribution and rotation/revocation policy, replay limits and trusted-clock assumptions.
3. Verify signatures and payload binding in isolation against tampering, replay, wrong keys, future/stale data, missing evidence and invalid versions.
4. Review actual endpoint transport and role permissions, integrate the verifier with the freshness gate, then perform browser tests and explicit deployment approval.

**Decision: NO-GO.** No production Supabase changes, grants revocation, frontend activation or PR merge.
