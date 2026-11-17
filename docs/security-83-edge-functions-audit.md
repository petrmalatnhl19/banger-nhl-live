# SECURITY-83 — Deployed Edge Functions

17 November 2026 · Draft PR #274 · **NO-GO**

Read the Supabase deployed function inventory and the deployed `index.ts` of each active function. All three report `verify_jwt=false`; authorization therefore depends on the application checks below. These versions came from the management API. Repository references describe callers or local test fixtures, and do not attest deployment.

| Active deployment | Authentication and role | Data path |
|---|---|---|
| `nhl-feed` v13 | GET plus OPTIONS. Checks a hard-coded client API key also present in browser code. Treat this as a public access key. | Fixed NHL and MoneyPuck upstream hosts; request kinds and path parameters are constrained. No database client or service role in the reviewed source. |
| `nhl-prediction-collect` v26 | POST gated by `PREDICTION_SCHEDULER_KEY` via `x-scheduler-key`. Missing key is rejected. Uses `SUPABASE_SERVICE_ROLE_KEY` server-side. | Reads and writes prediction archive, including freezing CORE 4.2 fields. A first-time timestamp update invokes the database trigger and indirectly writes shadow inputs. Its goalie identity diagnostic is behind the same gate. |
| `nhl-prediction-finalize` v7 | Same scheduler gate and server-side service role. | Reads and patches pending prediction archive rows. The reviewed finalize write does not update `core42_predicted_at`; no direct shadow/RPC call found. Completed goalie boxscore diagnostic is gated. |

Both scheduler functions check the header before diagnostic and write branches. Their string comparisons short-circuit. A future isolated check should validate failure modes and least privilege for scheduler credentials. Deployment metadata and source do not establish secret rotation, traffic policy, timing properties, runtime configuration or key provenance. No production function was invoked and no values of secret environment variables were requested. The production database is also reachable by the collector through an indirect trigger, which must remain covered by the isolated migration rehearsal.
