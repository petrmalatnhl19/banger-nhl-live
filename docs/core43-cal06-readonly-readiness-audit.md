# CORE43-CAL-06 read-only readiness audit

**Status: blocked for live scheduled collection.** The CAL-04 workflow disables the live job even on the default branch. Draft PR #230 exercises the collector with fixtures.

## Supabase access

The [SQL migration draft](sql/core43-cal06-reader-migration-draft.sql) is stored outside automated migration paths. It defines a separate `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` PostgreSQL role. The only role membership it grants is to `authenticator`, with permission to assume the reader role for a request and with inheritance and delegation disabled.

| Source in `public` | Allowed SELECT columns |
| --- | --- |
| `nhl_core43_schedule_snapshots` | `game_id, away_team, home_team, kickoff_at, fetched_at` |
| `nhl_prediction_archive` | `game_id, away_team, home_team, core42_predicted_at, core42_away, core42_home` |
| `nhl_core43_rotowire_observations` | `game_id, team_code, goalie_name, observed_status, observed_at, source_snapshot_at` |
| `nhl_core43_goalie_identity_map` | `goalie_id, goalie_name, team_code, observed_at` |
| `nhl_core43_goalie_snapshots` | `goalie_id, team_code, situation, fetched_at, created_at, source_sha256, x_goals_against, goals_against, shots_against` |

All five tables must already have RLS enabled. Each new policy applies only to SELECT by the reader. It allows all rows because the collector discovers games across the archive and loads historical identity and goalie snapshots. Column grants restrict each query to its exact projection. The existing archive SELECT policy for `anon` and `authenticated` stays in effect.

### pg_net blocks the migration

Read-only catalog inspection of `app-development` confirmed that `supabase_admin` owns `net`, that `PUBLIC` has schema `USAGE` and `EXECUTE` on all 12 routines, and that three relations or sequences carry `PUBLIC` grants. The reader role is absent. `PUBLIC` is an implicit grant to every role, so `NOINHERIT` and revoking privileges directly from the reader cannot remove it. `NOLOGIN` limits direct connections, but permissions still apply if PostgREST assumes the role. See [PostgreSQL REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html) and [Supabase's pg_net permissions guidance](https://supabase.com/kb/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).

The migration now rejects effective `USAGE` on `net` itself, even if routine permissions change. It still checks usable application schemas for executable routines, relation and sequence privileges, and schema creation rights. A failure occurs before the source grants, policies and PostgREST membership, and rolls back the role creation. The draft changes no shared ACLs. These checks cover application privileges at migration time. They do not model every PostgreSQL system privilege or detect future ACL drift. Keep the role `NOLOGIN` and recheck effective permissions before activation and after database or extension changes. Hiding `net` from PostgREST and setting a narrow `search_path` are additional controls, but neither removes database grants.

### Options for isolation

| Option | Conditions and impact |
| --- | --- |
| Stay on fixtures or consume a curated source export | Keep this migration blocked. With a future approved export, the collector would receive only the required projected data over a private read-only interface, without a database role or service-role credential. The exporting system needs its own access review, a freshness and provenance contract, and a retention limit. |
| Use an isolated data project or database | Verify effective ACLs and that the reader cannot use `net`, including after extension changes. An isolated project still needs a separate review of replication or export, costs, data freshness and JWT issuance. A project or branch that copies the same `PUBLIC` grants would still fail the check. |
| Review pg_net grants with Supabase | Consider only as a separate change backed by Supabase and an inventory of the pg_net worker role, cron jobs, database webhooks, trigger functions and other callers. On a disposable copy, verify least-privilege grants for required consumers, the reader denial, extension lifecycle and rollback. The extension's grants are managed by Supabase, and removing public grants can break callers that rely on them. |

The regression tests run only the ACL check from the draft against PostgreSQL 17 in memory. Fixtures cover effective grants through `PUBLIC`, attempted role-specific revokes, a private `net` schema, and unrelated routine, table, column, sequence and schema grants. The migration itself is not executed.

### REST authentication

The collector already sends the `sb_publishable_…` key as `apikey` and a separate bearer JWT with `role=core43_cal04_reader`. Supabase's gateway and PostgREST must validate that JWT against a signing key trusted by this project. PostgREST then assumes the JWT's database role for the request. The collector's local claim and expiry checks catch configuration errors. Signature verification and authorization belong to Supabase. See [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts), [PostgREST role selection](https://docs.postgrest.org/en/v14/references/auth.html), and [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).

A candidate issuer is Supabase Auth with a dedicated machine identity and a [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) that assigns the database role only for that identity's immutable UUID. Verify the existing hook configuration, the resulting role claim and normal user tokens in isolation before using this approach. Keep the project's signing key and privileged credentials out of the collector. The collector requires renewable, short-lived tokens delivered through `CORE43_SUPABASE_READONLY_TOKEN` and the publishable key through `CORE43_SUPABASE_PUBLISHABLE_KEY`. The issuer and renewal are pending.

Before enabling the live job, verify the effective database ACLs and the Data API's schema exposure. In an isolated environment, verify successful GET with the exact projections for all five tables and denials for writes, unrelated endpoints and omitted columns. Confirm invalid or expired JWTs are rejected, ordinary identities cannot assume the reader role, and fresh source rows reach the 45–75 minute window. No migration or hosted authentication test was run for this draft.

## Artifact restore and deduplication

The restore script queries successful runs from the CAL-04 workflow on the same branch, separately for scheduled and manual events. It excludes the current run ID, selects the newest eligible run, and downloads its named diagnostic report. It validates the report and ledger before the collector receives Supabase credentials. Missing downloads, invalid report content and absent ledger history stop the scheduled job. The manual `bootstrap_ledger` input can initialize an empty ledger only when the API returns no eligible prior run. Use it only for an intentional first run. If GitHub run history has been deleted, the API cannot distinguish that case from a first run.

Ledger keys identify the game, kickoff instant, 60-minute window and coefficient. Both earlier keys and new keys normalize equivalent timestamp representations to UTC. A change to the actual kickoff instant yields a separate deduplication key. The ledger still depends on GitHub's seven-day artifact retention, so an expired or deleted artifact can stop collection until history is recovered. Keep artifact recovery and token renewal in the operating plan before activation.

CAL-06 CI checks the SQL grant and policy contract against the actual collector projections and verifies the disabled live job. It sends requests to an in-memory REST fixture with a publishable key and a separate JWT fixture. The tests also run the same restore shell script with a mocked GitHub CLI. They cover selection and current-run exclusion, failure to list or download artifacts, invalid report content, first-run behavior, and rejection of privileged or expired credentials. CAL-05 uses real GitHub artifact upload and download between isolated jobs with fixture data. A real CAL-04 cross-run download and Supabase read still need verification before live activation.
