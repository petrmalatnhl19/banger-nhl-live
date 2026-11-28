# SECURITY-72 — Exact ACL-entry restore test (isolated PostgreSQL)

Date: 2026-11-17. Draft PR #274. **NO-GO** for production.

Added `security/local/security72-exact-acl-restore.sh` to the existing synthetic PostgreSQL workflow, after SECURITY-69 and SECURITY-70.

Inside a single transaction, the test creates a synthetic broad grant baseline for the five audited objects, captures `aclexplode(relacl)` entries (object, grantor, grantee, privilege type and grant option), applies the candidate public revocations, reconstructs missing entries with targeted `GRANT` statements and compares normalized ACL entries using bidirectional `EXCEPT ALL`. It then rolls back the entire transaction and checks that the previously committed restricted state remains unchanged.

The fixture grants are created by its local owner. It deliberately fails for grantors outside the fixture owner rather than claiming to restore arbitrary grantor identity. Exact ACL comparison here is stronger than the effective-bit comparison in SECURITY-70, but does not cover real production grantors, role memberships, default privileges, ownership changes, policy changes, external consumers, or deployment rollback. It does not run against Supabase.

**Verification pending:** GitHub Actions must pass on the final commit. Production remains unchanged; no merge, deploy, or scheduled activation.
