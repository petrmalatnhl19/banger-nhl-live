# SECURITY-141 — SQLite signature-gate bypass audit

**Result: direct bypass exists; production NO-GO.** The SECURITY-140 Python verifier protects only callers using its `submit()` function. A separate process with SQLite file access can open the database and update `latest` without any signature. SECURITY-138 also exposes an unsigned `update()` function. Neither a read-only SQLite URI for cooperative readers nor POSIX `0600` permissions prevents an attacker running as the same owner.

The isolated regression `.github/scripts/test-security-141-bypass-audit.py` inventories SQLite connection sites under `security/local` and `.github/scripts`, fails if new unreviewed security-module writers appear, reports other test writers, demonstrates the unauthorized direct SQL update on a disposable database, confirms a read-only SQLite URI refuses UPDATE, and confirms mode 0600 still permits same-owner writes. **The bypass demonstration succeeding is the intended test outcome, not proof that production is protected.**

Mitigations required before deployment: a dedicated privileged writer process/account and exclusive filesystem ownership, authenticated narrowly scoped IPC, separate read-only consumer identities, removal of direct-write helper entry points from the deployable artifact, and an independently durable signed latest-anchor witness. Validate threat model, filesystem permissions and backup/restore on the target platform. The static inventory is limited to Python SQLite connection patterns and is not an exhaustive whole-repository security proof.

No Supabase access/writes, production grants/CORE changes, merge or deployment. PR #274 remains Draft.
