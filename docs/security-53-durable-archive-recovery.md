# SECURITY-53 — Local durable archive recovery exercise

The standalone Python standard-library test `.github/scripts/test-security-53-archive-recovery.py` creates a temporary file-backed SQLite WAL database with synchronous FULL. It exercises committed persistence after reopening, same-key idempotent retries, conflicting duplicate rejection, abrupt subprocess termination during an uncommitted insert, recovery with no partial row, database integrity check, and detection of altered payload/checksum.

This is a **synthetic, offline resilience test**, not an integration with the signed SECURITY-52 in-memory records, the real CORE43-CAL planner, or a production immutable store. A privileged database writer can alter both payload and checksum; SHA-256 alone does not prevent that. PostgreSQL deployment, external timestamp anchors, independent source identity, write-once storage, backup/restore, and fault injection on production-like infrastructure remain unverified.

No production CORE 4.2, Supabase, schedules or deployment changed. PR #274 Draft; release **NO-GO**.
