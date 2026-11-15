# CORE43-CAL-28 — receiver preflight hardening (part 1)

The CAL-24 writer now invokes the read-only CAL-25 audit after acquiring its own exclusive lock and before reading or replacing the receiver pin. Its own lock is expected; every other finding (including orphaned `.next-*` files, symlinked pin, malformed or missing pin, or unreadable directory) stops advancement. The writer does not remove suspicious temporary files. Manual recovery review remains required.

Tests: `node --test scripts/test_core43_cal28_preflight.cjs`. This closes finding CAL27-01 for the tested cases, but does not establish filesystem race resistance, secure directory permissions, independent operator approval, or archive completeness. Findings CAL27-02 through CAL27-06 remain open. No live collection, Supabase writes, merge, deployment, or changes to CORE 4.2.
