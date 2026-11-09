# CORE 4.3 – verified production forecast provenance (2026-11-09)

## Confirmed production source
Supabase project `xxwqeiuyislnoxsmjuul`, active Edge Function `nhl-prediction-collect` version 26 (inspected through Supabase function source). **No deployment performed.**

- Initial game record: `POST /rest/v1/nhl_prediction_archive?on_conflict=game_id` with `resolution=ignore-duplicates`, `baseline_away/home` and `predicted_at`.
- CORE 4.1: conditional `PATCH` for `status=pending` and `core41_away/home IS NULL`. Inputs are pregame frozen archive components with quality gating; persists `core41_away`, `core41_home`, `core41_factors`, `core41_version`, `core41_predicted_at`.
- CORE 4.2: conditional `PATCH` for `status=pending` and `core42_away/home IS NULL`, following pregame checks and late-goalie input validation. Persists `core42_away`, `core42_home`, `core42_factors`, `core42_version`, `core42_predicted_at`.
- CORE 4.3 `core43_gsax_sensitivity_v0` is **hypothetical**, not a calibrated production forecast. Do not persist it as a valid prediction.

## Important integration constraints
1. Never overwrite historical CORE 4.1/4.2 rows or change the production model output.
2. Existing `core41_predicted_at` is the time of the original forecast. A CORE 4.3 revision must have its **own later, genuinely computed** timestamp strictly before kickoff; do not re-label a stored CORE 4.1 forecast as a newly computed revision.
3. Confirmed goalie evidence must have been published and verified **as of** the revision timestamp, with stable goalie identities and no conflicts.
4. `nhl_prediction_revisions` requires actual forecast values, immutable input snapshot, origin timestamp and unique revision identity. Existing experimental writer is not a production collector.
5. Current batch assembler is pure/dry-run. The next integration should be server-side, idempotent, transactionally guarded and tested under concurrent runs before any write is enabled.
6. Do not expose service-role credentials to `index.html` or browser code. Preserve the active Edge Function's current behavior until independently tested.
7. Reconcile archive `game_id`, schedule `game_id`, kickoff, and team codes; reject ambiguous snapshots and timestamps.

## Safe next implementation milestone
Create a separate **read-only** adapter that ingests the existing archived CORE 4.1 and CORE 4.2 snapshots and reports their source timestamps, factors, and eligible future games. It must explicitly distinguish **existing frozen forecasts** from **new CORE 4.3 revisions**. Validate real data first; only then design the server-side write transaction and enable it through a separately reviewed rollout.
