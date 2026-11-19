# SECURITY-54 — Persistent four-variant replay (offline)

The Python standard-library test `.github/scripts/test-security-54-persisted-chain.py` calls the existing experimental `calculateShadow` function in a Node subprocess, calculates four coefficient variants from a synthetic frozen pregame input, writes the resulting bundle to a temporary file-backed SQLite database (WAL, FULL synchronous), reopens it, verifies payload integrity, checks deterministic recalculation, idempotent retry, conflicting duplicate rejection and tampered-checksum rejection.

**Important scope boundary:** This is a bridge between the four-variant experimental calculation and the persistent-storage pattern of SECURITY-53. It does **not** reuse or persist the independently signed publisher/witness receipt from SECURITY-52, nor cryptographically validate a real provider. Its evidence timestamps are synthetic and checked locally; it does not implement a true external trust anchor. A privileged database writer can replace the record and recompute its hash. Next work must persist and verify the actual signed SECURITY-52 envelope together with the frozen input, without duplicating test-only evidence logic.

No production CORE 4.2 changes, no Supabase, no schedules, no deployment. Draft PR #274, release **NO-GO**.
