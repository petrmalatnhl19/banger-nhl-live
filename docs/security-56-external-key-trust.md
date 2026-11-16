# SECURITY-56 — External synthetic trust registry

An isolated offline Node test stores a pinned synthetic Ed25519 publisher/witness key registry **separately** from the archived evidence. Verification resolves keys by role and key ID from the registry, never from the untrusted archive-carried public keys. It checks distinct publisher/witness keys, signed source/witness records, source hash, cutoff, validity windows, revocation, duplicate/unknown IDs, cross-game replay, forged signatures and archive-carried key substitution.

The trust registry itself is a **locally generated test fixture**: it is not signed or deployed, has no authenticated external publisher or witness, and does not validate actual NHL feeds. Its security depends on securely provisioning and protecting an independently authenticated registry in a later stage. This standalone SECURITY-56 contract does not yet integrate with the SECURITY-55 persistent archive verifier.

No production changes, Supabase access, scheduled activation, merge or deployment. PR #274 remains Draft and release **NO-GO**.
