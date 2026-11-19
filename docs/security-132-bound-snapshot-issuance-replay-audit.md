# SECURITY-132 — Offline bound signed snapshot, issuance and replay chain

**Production: NO-GO.** This stage tests a single synthetic chain in `.github/scripts/test-security-132-bound-chain.cjs`: SECURITY-126 validates a signed public snapshot and computes its canonical SHA-256 digest; SECURITY-131 validates a separate signed issuance envelope with audience, game scope, sequence and expiry; the integration compares the signed digest to the verified snapshot digest and verifies game scope; only then does the fixture call SECURITY-130's disposable SQLite worker to atomically accept a scoped issuance.

Tests reject tampered snapshots, altered envelope digests, mismatched game scopes, expired envelopes, duplicate issuance and a new sequence reusing an old digest. The database is temporary and deleted on completion. CI runs the test under the existing offline security workflow.

**Trust boundary:** the SQLite worker's `verified=True` parameter is still a synthetic test switch. The Node harness validates signatures before calling it, but this process boundary is **not authenticated**: it is not safe for production and must not be exposed as an API. The test uses generated ephemeral signing keys, not trusted operational issuer keys. The synthetic clock does not prove historical pre-game issuance. Multi-game snapshot scope semantics, trusted timestamping, key rotation/revocation, cross-process authenticated attestation and multi-node durable transaction semantics remain unimplemented. This test does not authorize production publication or database writes.

No Supabase connections, migrations, production UI or CORE changes. PR #274 stays Draft; no merge or deployment.
