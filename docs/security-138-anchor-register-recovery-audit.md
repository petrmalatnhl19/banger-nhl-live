# SECURITY-138 — Disposable monotonic checkpoint anchor register

**Production: NO-GO.** The offline test `.github/scripts/test-security-138-anchor-register.py` models an independent SQLite latest-anchor register. It runs twelve competing OS-process updates to the same scope and next epoch; exactly one must commit. It denies duplicate/older/skipped epochs, confirms independent scope isolation, terminates a subprocess after an uncommitted transaction, verifies rollback and retries successfully. SQLite integrity is checked after the crash.

**Trust boundary:** The test stores synthetic fingerprints; it does **not** validate the SECURITY-137 Ed25519 anchor before writing. Its SQLite file is a disposable local fixture, **not independently protected** from a database+anchor rollback, nor is it a distributed monotonic service. No operational backup, key management, durable remote witness, fsync/power-loss guarantee or production restore authorization is supplied. A production design needs authenticated updates, independent anti-rollback persistence and recovery protocol.

No Supabase connections or writes, production grants, CORE 4.2, deployment or merge. PR #274 stays Draft.
