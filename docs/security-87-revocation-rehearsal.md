# SECURITY-87 — Revocation and rollback rehearsal

Native PostgreSQL 17.11 passed the SQL rehearsal against the repository's synthetic fixture. The same SQL is wired into the existing PostgreSQL 17 Compose CI job.

The test reconstructs broad direct ACLs and service BYPASSRLS in a transaction, captures normalized ACL entries, applies the five-object restriction and tests role behavior. It verifies both the direct service/cron-equivalent capture and the service archive update that triggers capture. It reconstructs missing grants under the original local grantor and checks exact set equality including grant options. Transaction rollback is then compared against the original fixture ACL and the test checks that the newly seeded archive rows are gone.

Parity limits: fixture owner `security_local` is local and privileged, production owner is managed `postgres`. The service update grant is scoped to the trigger column and added only in the transaction. The fixture uses synthetic rows and does not run PostgREST, JWT mapping, pg_cron, remote Edge code, the real starter-evidence cron, traffic or actual production grantor topology. Website compatibility for the TV panel is covered separately in SECURITY-88. Exact fixture ACL recovery does not establish production rollback viability.
