# SECURITY-131 — Synthetic signed issuance envelope policy

**Production decision: NO-GO.** Offline-only Ed25519 verification of a canonical domain-separated issuance envelope binding version, audience, game scope, positive sequence, SHA-256 public payload digest, issue time and expiry. Unknown, revoked or inactive keys, malformed signatures, tampering, wrong audience, expired or future issuance fail closed.

Files: `security/local/security131-signed-issuance.cjs` and `.github/scripts/test-security-131-signed-issuance.cjs`; regression is wired into `security-grants-offline.yml`.

## Important limitations
Synthetic keys only. A valid signature does not establish a trusted signer, timestamp authority, original pre-game issuance or real-world provenance. This module does not connect to the SECURITY-130 SQLite transaction gate; the signed digest must be compared to a separately verified snapshot before acceptance in any future integration. A trusted, independently managed key registry, key rotation/revocation, transactional replay store, server-side issuer and historical timestamp checks remain prerequisites. No production or Supabase changes; no CORE 4.2 changes. Keep PR #274 Draft, do not merge or deploy.

Next: SECURITY-132 can test explicit binding between the SECURITY-126 snapshot digest, SECURITY-131 signed issuance envelope and SECURITY-130 disposable replay transaction, still offline.
