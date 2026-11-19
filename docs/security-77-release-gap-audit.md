# SECURITY-77 — Release-gap audit, SECURITY-69 through SECURITY-76

Date: 2026-11-17. Scope: read-only GitHub review of stage documents, actual PostgreSQL workflow, SECURITY-69 test code and prior release-gap/consumer reports. Draft PR #274 only. Production **NO-GO**.

## Confirmed coverage

| Stage | Evidence | What it establishes |
| --- | --- | --- |
| 69 | `security/local/security69-transaction-rollback.sh` | Synthetic proposed REVOKE in transaction, ROLLBACK and actual-role SELECT checks; SECURITY-77 tightened initial assertions to check each SELECT/INSERT/UPDATE/DELETE privilege separately |
| 70 | `security/local/security70-baseline-restore.sh` | Per-role effective privilege-bit capture, replay and comparison; not full ACL provenance |
| 71 | `docs/security-71-production-acl-inheritance-audit.md` | Read-only production `relacl`, owners, view options and membership snapshot for six selected objects |
| 72 | `security/local/security72-exact-acl-restore.sh` | Synthetic exact `aclexplode` entries (grantor, grantee, privilege, grant option), single owner |
| 73 | `security/local/security73-inheritance-delegation.sh` | Synthetic role membership inheritance, delegated grant option, CASCADE and rollback |
| 74 | `security/local/security74-multigrantor-restore.sh` | Two independent grantors and two distinct delegated readers |
| 75 | `security/local/security75-multilevel-grants.sh` | Linear multi-level delegation and dependent CASCADE |
| 76 | `security/local/security76-multipath-grants.sh` | Two independent paths to same leaf; selective loss and full restore |

All eight shell scripts (SECURITY-69,70,72–76) are wired into `.github/workflows/security-local-postgres.yml`, after the pre-existing `verify.sh`. SECURITY-71 is a read-only audit, not a shell test. SECURITY-76 final prior commit `7d113f582746d58ca952a4f2c429fa3dbc91323c` had four workflows/five jobs passing as independently checked. **New SECURITY-77 fix must be validated on its own final commit**.

## Discovered test weakness and correction

SECURITY-69 previously passed `'SELECT,INSERT,UPDATE,DELETE'` as one privilege argument to `has_table_privilege`. PostgreSQL treats comma-separated privilege names as an **any-of** check, so it could miss absent individual privileges. SECURITY-77 replaces it with a loop checking each privilege independently. This changes the local synthetic test only, not production grants.

## Unresolved release blockers

**P0 — NO-GO**
1. Production `anon` and `authenticated` retain direct broad ACL grants on CORE43 shadow inputs, three internal views and CORE42 status. No approved production remediation or rollback exists; live SECURITY-71 only inspected six objects.
2. Complete consumer compatibility is not proven: external REST/RPC clients, Edge Functions, stored procedures, cron roles and indirect references need exhaustive inventory and staging verification. Preserve public CORE42 status SELECT and public analytics/schedule behavior.
3. Approved authentic frozen pregame starter/goalie/GSAx inputs and independently verifiable provenance remain incomplete.
4. Independent trust root and externally durable anti-rollback checkpoint remain unproven; synthetic signatures and local anchors are not external trust.

**P1 — pre-release integration**
5. No production-like isolated Supabase integration test of RLS, owner-context views, API consumers and exact ACL migration/rollback; current tests use synthetic PostgreSQL fixtures.
6. No approved production operational feature gate, monitoring, emergency stop or incident rollback.
7. CORE 4.3 experimental `calculateShadow` variants are not a calibrated full production CORE 4.3 prediction engine.

**P2 — evidence**
8. No prospective frozen pregame-only accuracy pilot demonstrating improvement over CORE 4.2.
9. PR #274 divergence from `main` and integration compatibility must be rechecked before merge; no merge authorized.

## Next recommended action

SECURITY-78: build an automated read-only **consumer/dependency inventory** across repository, database metadata and approved API interfaces; identify which clients use each of five target objects. Follow with an isolated production-like permission migration rehearsal, not another synthetic grant-graph variant. No human reviewer required for this preparatory work.

No production SQL writes, deployment, schedule activation, merge or CORE 4.2 changes. Release remains **NO-GO**.
