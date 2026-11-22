# CORE 4.3 readiness view: deployment gate

Checked 2026-11-22 against the live `app-development` project (read-only).

- GitHub `main` exact-name search found no functional code consumer of `core43_shadow_readiness_v1`; references were confined to the prior security audit and its test/fixture.
- All three deployed Edge Functions were retrieved and searched for both `core43_shadow_readiness_v1` and `shadow_readiness`: `nhl-feed` v13, `nhl-prediction-collect` v26 and `nhl-prediction-finalize` v7. **No direct references found.**
- Postgres dependency audit found no dependent views.
- Both `anon` and `authenticated` can currently SELECT this view; earlier read-only role checks each returned 198 rows. This is a real public-access issue, not just an advisor warning.
- Existing GitHub CI on PR #421: SECURITY readiness ACL proposal **success**; Frontend smoke checks **success** on commit `18940f818f37b24241a9ae3dd153505d835b2f43`.

## Remaining deployment gates

1. Confirm no external client, scheduled job or dynamically constructed REST request relies on this view. Static searches cannot rule out external consumers.
2. Confirm whether the REST API endpoint is publicly exposed, and test its current status and a safe `select=game_id&limit=1` response without logging actual data.
3. Obtain **explicit production approval** before running the proposed REVOKE. Merging this PR by itself does **not** deploy SQL.
4. After deployment, verify `anon` and `authenticated` SELECT denied, `service_role` SELECT allowed, and public app smoke tests green.
5. If an essential client fails, restore the previous view ACL only after review. Keep base tables and CORE model logic untouched.

The SQL file is a proposal, not an applied migration. This PR must remain Draft until gates are completed.
