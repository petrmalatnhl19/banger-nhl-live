# SECURITY-70 — Synthetic baseline-derived privilege restoration

Date: 2026-11-17. Draft PR #274, production **NO-GO**.

The local PostgreSQL test `security/local/security70-baseline-restore.sh` runs after SECURITY-69. In an **uncommitted transaction** it re-creates a broad synthetic grant baseline, captures per-role/per-object/per-privilege effective `has_table_privilege` bits into a temporary table, applies the proposed restrictions, generates privilege-specific GRANT statements from the captured baseline, checks the restored privilege matrix, then ROLLBACKs the entire transaction. After rollback it confirms the previously committed restricted fixture remains restricted.

Covered roles: `anon`, `authenticated`. Covered objects: CORE43 shadow inputs, three internal views and CORE42 status. Privileges: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER. This avoids a blanket `GRANT ALL` in the restoration step.

**Important limitations:** This test checks **effective** privilege bits, not exact ACL provenance (direct grants vs PUBLIC vs inherited memberships), grant options, owner changes, default privileges, policies, view owners or real API clients. Thus it is **not** an exact production ACL rollback plan. The initial fixture re-grant is synthetic and uncommitted. The workflow must actually pass before the test is considered verified.

Before production migration, capture full `relacl`/grantor/grantee/privilege/grant-option and role membership state, compare production-like staging before/after behavior and derive an explicit reviewed rollback. Never execute this fixture script against production. No production DB, CORE 4.2, deployment, schedule or other PR modified.
