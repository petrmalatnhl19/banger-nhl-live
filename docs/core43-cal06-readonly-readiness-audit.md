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

Read-only catalog inspection of `app-development` confirmed all 30 columns and found effective access that a new role would receive through `PUBLIC`. The `net` schema grants `USAGE` to `PUBLIC` and exposes executable routines including `net.http_post`. The draft checks for effective routine, relation, sequence, and schema CREATE privileges before granting source access. It would abort on the current `net` grants and roll back the transaction. It changes no existing ACLs. Resolve the shared grants with a separate review of the extension's callers before considering this migration. The finding concerns database permissions. HTTP exposure of the `net` schema has not been verified.

### REST authentication

The collector already sends the `sb_publishable_…` key as `apikey` and a separate bearer JWT with `role=core43_cal04_reader`. Supabase's gateway and PostgREST must validate that JWT against a signing key trusted by this project. PostgREST then assumes the JWT's database role for the request. The collector's local claim and expiry checks catch configuration errors. Signature verification and authorization belong to Supabase. See [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts), [PostgREST role selection](https://docs.postgrest.org/en/v14/references/auth.html), and [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).

A candidate issuer is Supabase Auth with a dedicated machine identity and a [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) that assigns the database role only for that identity's immutable UUID. Verify the existing hook configuration, the resulting role claim and normal user tokens in isolation before using this approach. Keep the project's signing key and privileged credentials out of the collector. The collector requires renewable, short-lived tokens delivered through `CORE43_SUPABASE_READONLY_TOKEN` and the publishable key through `CORE43_SUPABASE_PUBLISHABLE_KEY`. The issuer and renewal are pending.

Before enabling the live job, verify the effective database ACLs and the Data API's schema exposure. In an isolated environment, verify successful GET with the exact projections for all five tables and denials for writes, unrelated endpoints and omitted columns. Confirm invalid or expired JWTs are rejected, ordinary identities cannot assume the reader role, and fresh source rows reach the 45–75 minute window. No migration or hosted authentication test was run for this draft.

## Artifact restore and deduplication

The restore script queries successful runs from the CAL-04 workflow on the same branch, separately for scheduled and manual events. It excludes the current run ID, selects the newest eligible run, and downloads its named diagnostic report. It validates the report and ledger before the collector receives Supabase credentials. Missing downloads, invalid report content and absent ledger history stop the scheduled job. The manual `bootstrap_ledger` input can initialize an empty ledger only when the API returns no eligible prior run. Use it only for an intentional first run. If GitHub run history has been deleted, the API cannot distinguish that case from a first run.

Ledger keys identify the game, kickoff instant, 60-minute window and coefficient. Both earlier keys and new keys normalize equivalent timestamp representations to UTC. A change to the actual kickoff instant yields a separate deduplication key. The ledger still depends on GitHub's seven-day artifact retention, so an expired or deleted artifact can stop collection until history is recovered. Keep artifact recovery and token renewal in the operating plan before activation.

CAL-06 CI checks the SQL grant and policy contract against the actual collector projections and verifies the disabled live job. It sends requests to an in-memory REST fixture with a publishable key and a separate JWT fixture. The tests also run the same restore shell script with a mocked GitHub CLI. They cover selection and current-run exclusion, failure to list or download artifacts, invalid report content, first-run behavior, and rejection of privileged or expired credentials. CAL-05 uses real GitHub artifact upload and download between isolated jobs with fixture data. A real CAL-04 cross-run download and Supabase read still need verification before live activation.
