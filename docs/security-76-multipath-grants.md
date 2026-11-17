# SECURITY-76 — Independent grant paths

Date: 2026-11-17. Draft PR #274. Production **NO-GO**.

The isolated PostgreSQL regression `security/local/security76-multipath-grants.sh` grants two independent synthetic roles SELECT WITH GRANT OPTION on one fixture table. Both delegate SELECT to the same leaf role. The test snapshots normalized ACL entries with grantor identity and grant options; revokes the first parent's grant option with CASCADE and verifies that the second independent path still grants access. Revoking the second parent's grant option must remove the leaf's access. It then restores the two parent grants and both delegated edges under their original grantors, compares exact ACL rows bidirectionally, and rolls back all changes. Post-rollback checks ensure no synthetic roles or fixture table persist.

This specifically tests a two-path graph, not arbitrary cycles, membership inheritance, multiple owners, cross-schema dependencies, production authorization or Supabase REST consumers. It cannot justify a production grant migration. No production SQL writes, merges, deployments, scheduled jobs or CORE 4.2 changes. CI results on the final commit remain a required release gate.
