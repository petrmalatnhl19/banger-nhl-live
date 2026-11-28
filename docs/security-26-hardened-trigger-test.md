# SECURITY-26 — hardened CORE43 trigger integration test

Scope: synthetic PostgreSQL in Draft PR #274 only; no production Supabase writes, no deployment, no CORE 4.2 modification.

The local test starts a transaction and temporarily sets both privileged CORE43 functions to `search_path = pg_catalog, public, pg_temp`. It creates a synthetic archive game (ID 26) with a null CORE 4.2 prediction timestamp, adds two confirmed goalie evidence rows, and updates the prediction timestamp. The UPDATE must fire `core43_shadow_on_core42` and capture exactly two CORE43 shadow rows with readiness `ready`. A repeated explicit capture must not create duplicates.

The transaction is rolled back; assertions verify the synthetic game and capture rows are absent and both functions retain their original `search_path=public` setting. No production SQL is executed.

**Release gate:** await green local PostgreSQL CI on the latest commit. Passing these checks validates this synthetic path only, not production readiness. Continue production NO-GO and keep PR Draft.
