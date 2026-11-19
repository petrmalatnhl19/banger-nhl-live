# SECURITY-74 — Multi-grantor ACL recovery rehearsal

Date: 2026-11-17. Draft PR #274; **NO-GO**.

The local PostgreSQL 17 test `security/local/security74-multigrantor-restore.sh` constructs a synthetic table, two independent grantors with SELECT WITH GRANT OPTION, and two distinct delegated readers. It captures all `aclexplode(relacl)` rows, including grantor/grantee/privilege/grant-option, removes both grant options with CASCADE, checks both readers lost access, restores parent grant options, replays delegated grants **under their original granting roles**, and checks exact normalized ACL equality using bidirectional EXCEPT ALL. The whole transaction is rolled back; no roles or fixture tables persist.

This closes the synthetic single-grantor coverage gap in SECURITY-72. It does **not** constitute a general-purpose automated production ACL restoration tool: real dependency cycles, multi-level delegation, alternate owners, default privileges, RLS, and Supabase client compatibility remain untested. It never changes production Supabase, CORE 4.2, deployment, or scheduled tasks. CI validation on the final commit is required before declaring the stage green.
