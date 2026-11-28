# SECURITY-59 — Integrated signed registry gate for synthetic archive

The standalone offline Node test persists a signed source and witness record with four outputs from the real experimental `calculateShadow` function. A separate versioned key registry is signed by a locally pinned synthetic root key. A separate minimum-version/hash checkpoint is checked when the archived evidence is reloaded.

Negative cases: rollback to a valid older signed registry, attacker-signed registry replacement, forged source signature with recomputed archive hash, and tampered output with recomputed archive hash. The original archive and current registry must continue to verify.

**Security boundary:** All keys and files are synthetic and locally generated. The root key and checkpoint are not independently protected against a privileged adversary; an attacker controlling both checkpoint and registry can potentially roll back both. This is not a production persistence layer, authenticated NHL publisher, external timestamp witness, or real CAL-03 integration. The test is an offline integration of prior contracts, not a production release authorization.

No production CORE 4.2/Supabase changes, no merge or deployment. Draft PR #274, **NO-GO**.
