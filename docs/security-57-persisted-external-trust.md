# SECURITY-57 — Persistent archive with external synthetic key registry

Standalone offline Node test persists a synthetic signed source/witness evidence bundle and four real experimental `calculateShadow` variants to a temporary file, alongside a **separately stored** synthetic trust registry. After reopening, verification uses only registry keys, validates time cutoff, publisher and witness signatures, source hashes, and recomputes four predictions. Negative tests replace archive-carried public keys and re-sign the source, tamper predictions while recomputing the archive digest, and revoke the registry publisher key. All must fail closed.

This extends the SECURITY-55/56 test patterns but is **not yet a production archive implementation**. The fixture registry is not authenticated by a real external authority; a privileged attacker who can alter both files can still subvert it. File persistence is a local synthetic exercise, not an atomic durable database integration or actual CAL-03 planner. Independent trust-root provisioning, key rotation, rollback protection and real-world publisher/witness authentication remain open.

No production writes, Supabase changes, merge, schedules or deployment. Draft PR #274, **NO-GO**.
