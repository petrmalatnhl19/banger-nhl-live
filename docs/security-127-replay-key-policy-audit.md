# SECURITY-127 — Offline replay prevention and key policy

Status: **NO-GO** for production. Adds a stateful, in-memory offline gate around SECURITY-126 verification.

## Guarantees in this test-only model
- Only explicitly allowed key IDs can verify; revoked IDs are denied.
- Ed25519 signature and SECURITY-118 freshness are checked before accepting a snapshot.
- Repeated digests and snapshots whose minimum timestamp is not strictly newer than the last accepted one are rejected.
- Invalid signatures, tampering and stale/future data fail closed.

## Limitations and required follow-up
- Replay state is **in-memory only**. Restarting a process loses the history; separate processes do not share it. This is not a production replay defense.
- A monotonic timestamp is not a globally unique issuance sequence and does not establish historical pre-game publication.
- Key allowlist/revocation policy is supplied by a trusted caller; there is no operational key registry, rotation, expiration or revocation feed.
- Timestamp advancement is tracked globally in this demonstration; production must define appropriate game/feed scopes and transactionally persisted sequence numbers.
- Only the approved public projection is signed, not private source records.

Before production: design durable atomic replay storage, signed issuance IDs and sequence, scoped audience and expiry, trusted key rotation/revocation and audit logs; test concurrency, restart and multi-instance behavior. Complete SECURITY-100 release gates and obtain explicit approval.

No changes to production UI, Supabase or grants. PR #274 remains Draft.
