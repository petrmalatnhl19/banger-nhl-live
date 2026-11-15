# CORE43-CAL-06 read-only readiness audit

**Status: blocked for live scheduled collection.** Draft PR #230 exercises the collector with fixtures. The live job is restricted to scheduled or manual events on the default branch. GitHub Actions runs no live collection for the draft PR.

## Supabase access

The collector expects `CORE43_SUPABASE_PUBLISHABLE_KEY` as the Data API key and `CORE43_SUPABASE_READONLY_TOKEN` as a project-trusted JWT with the `core43_cal04_reader` role. The CLI checks the credential types, role claim and expiry before its first request, sends only GET requests, and rejects redirects. Supabase verifies the token signature and enforces the effective role grants and RLS. The local checks have no way to verify those grants.

The collector reads these tables through the Data API:

- `nhl_core43_schedule_snapshots`
- `nhl_prediction_archive`
- `nhl_core43_rotowire_observations`
- `nhl_core43_goalie_identity_map`
- `nhl_core43_goalie_snapshots`

Live readiness requires confirming from database metadata that the effective role can select the required columns and rows, lacks write privileges including inherited grants, and cannot execute functions that write on its behalf. The live credential, effective grants, source visibility, and freshness in the 45–75 minute window still need verification. No changes to Supabase are part of this PR.

## Artifact restore and deduplication

The restore script queries successful runs from the CAL-04 workflow on the same branch, separately for scheduled and manual events. It excludes the current run ID, selects the newest eligible run, and downloads its named diagnostic report. It validates the report and ledger before the collector receives Supabase credentials. Missing downloads, invalid report content and absent ledger history stop the scheduled job. The manual `bootstrap_ledger` input can initialize an empty ledger only when the API returns no eligible prior run. Use it only for an intentional first run. If GitHub run history has been deleted, the API cannot distinguish that case from a first run.

Ledger keys identify the game, kickoff instant, 60-minute window and coefficient. Both earlier keys and new keys normalize equivalent timestamp representations to UTC. A change to the actual kickoff instant yields a separate deduplication key. The ledger still depends on GitHub's seven-day artifact retention, so an expired or deleted artifact can stop collection until history is recovered. Keep artifact recovery and token renewal in the operating plan before activation.

CAL-06 tests run the same restore shell script with a mocked GitHub CLI. They cover selection and current-run exclusion, failure to list or download artifacts, invalid report content, first-run behavior, and rejection of privileged or expired credentials. CAL-05 uses real GitHub artifact upload and download between isolated jobs with fixture data. A real CAL-04 cross-run download and Supabase read still need verification before live activation.
