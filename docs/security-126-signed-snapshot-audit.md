# SECURITY-126 — Offline signed TV snapshot verification

Status: **NO-GO for production**. This milestone provides a Node.js-only verifier and synthetic Ed25519 regression tests. No production keys, signature service, UI integration, API endpoint, Supabase writes or grants changes.

The signed payload has a domain separator and deterministic JSON serialization of the SECURITY-123 public contract: version, both UTC timestamps, sorted public metadata and predictions. SHA-256 identifies the exact canonical public payload. Ed25519 verification requires a public key from an independently trusted key map and rejects unknown key IDs, malformed signatures and wrong keys. The verifier then applies SECURITY-118 completeness, freshness and skew checks, and SECURITY-125 provenance policy. Failure returns an unverified state with no rows or digest.

**Limitations:** The signature proves only possession of the corresponding private key, not that the source is authoritative or that the original prediction preceded puck drop. The test creates a disposable synthetic keypair. Replay within the freshness window is not prevented by this verifier. Signature canonicalization drops non-public fields by design: those fields are not integrity-protected. No key rotation, revocation, trusted timestamp authority, server-side issuance, or production clock provenance exists yet. The verifier must not be imported into browser production code as-is.

**Next gates:** approve authoritative signer and payload eligibility, implement protected server-side signing and independently managed trusted public keys, test revocation/replay and historical game timestamp constraints, verify real HTTP/role behavior, and obtain explicit release approval before migration.

PR #274 remains Draft. SECURITY-100 production decision remains **NO-GO**.
