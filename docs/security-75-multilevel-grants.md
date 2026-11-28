# SECURITY-75 — Multi-level delegated grant chain

Date: 2026-11-17. Draft PR #274. Production **NO-GO**.

Added `security/local/security75-multilevel-grants.sh` to the isolated PostgreSQL workflow. A synthetic owner grants SELECT WITH GRANT OPTION to role A; A delegates WITH GRANT OPTION to B; B delegates WITH GRANT OPTION to C; C grants SELECT to D. The test captures normalized ACL entries including grantor/grantee/privilege/grant-option, removes A's grant option with CASCADE, checks that B/C/D lose SELECT, then restores all edges in topological dependency order using the original grantor roles. Bidirectional EXCEPT ALL verifies exact ACL entry equality, and the leaf's access must return. Transaction ROLLBACK removes the fixture and all roles.

This covers one linear delegated chain, not arbitrary cyclic grant graphs, multiple independent paths, cross-schema grants, role ownership changes or production Supabase API behavior. No production writes, no deployment, no merge, no scheduled activation. Latest-commit GitHub Actions must pass before the stage is considered validated.
