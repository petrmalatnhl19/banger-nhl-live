# SECURITY-143 — Distinct-UID offline integration

**Linux offline test only; production NO-GO.** `.github/scripts/test-security-143-distinct-uid.py` runs the SECURITY-142 signed Unix socket writer as the CI runner user and executes an adversarial client as Linux user `nobody` through `sudo -n -u nobody`. A private 0700 database directory denies the client direct SQLite access. The test permits socket traversal (0711) and socket connection (0666), and verifies a correctly signed request succeeds while replay fails. The client cannot control the server's database path or trust registry. The test explicitly fails rather than silently skipping if Linux distinct-UID execution is unavailable.

**Security limitations:** The test socket is intentionally world-connectable to demonstrate cross-UID access to the signature gate. It does not authenticate Unix peer credentials; any local account could submit signed requests. There is no production account provisioning, supervisor, seccomp, hardened socket directory ownership, rate limiting, or independent witness. The CI runner owner still has direct database access, so privilege separation is not complete for compromised writer identities. `sudo` is used solely by the offline test harness; never add it to production request processing.

No Supabase access, no production grants or CORE changes, no merge or deployment. PR #274 stays Draft.
