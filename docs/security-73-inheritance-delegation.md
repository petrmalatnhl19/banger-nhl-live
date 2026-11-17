# SECURITY-73 — Inherited roles, grant delegation and cascading revocation

Date: 2026-11-17. **Isolated synthetic PostgreSQL only**. Draft PR #274. Production **NO-GO**.

## Test design

`security/local/security73-inheritance-delegation.sh` runs after SECURITY-72 in the existing disposable PostgreSQL 17 GitHub Actions job. Within one transaction it creates four synthetic roles and a fixture table.

- A parent receives SELECT **WITH GRANT OPTION**.
- An inheriting child receives a membership with `INHERIT TRUE` and can SELECT.
- A non-inheriting child receives `INHERIT FALSE, SET TRUE` and has no inherited SELECT.
- The test executes an actual SELECT under the inheriting child using `SET LOCAL ROLE`.
- The parent delegates SELECT to another role; `aclexplode(relacl)` must show the parent as grantor and the delegate as grantee without grant option.
- `REVOKE GRANT OPTION FOR SELECT ... CASCADE` must remove the delegated grant; then the fixture re-establishes the grant option and delegated SELECT.
- `ROLLBACK` must remove all synthetic roles and fixture objects.

The test is deliberately limited to a local synthetic table. It does not alter or revoke any real Supabase privileges, does not prove production role memberships or API compatibility, and is not a production rollback procedure. In particular, the previous SECURITY-72 exact-ACL fixture test does not automatically reproduce multi-grantor delegated ACL graphs; this stage exercises that separate edge case.

**Verification:** The new GitHub Actions run must pass before marking this stage validated. No merge, deployment, production database write or CORE 4.2 change.
