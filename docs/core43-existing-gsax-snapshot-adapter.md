## Existing archived goalie GSAx snapshots

The Supabase table `nhl_core43_goalie_snapshots` already contains goalie-level season snapshots. Read-only inspection on 2026-11-11 found **374 rows across 5 fetched-at/source-hash groups**, with 64-character source hashes and `situation='all'`.

`scripts/core43_archived_gsax_snapshot_adapter.cjs` converts timestamped database rows into the pure source-assembly format. It requires both `fetched_at` and `created_at` to be no later than the prediction as-of time; a source hash is a provenance identifier, **not proof that a prediction was frozen or that the hash was independently verified**. Conflicting goalie rows within a group are rejected. The live preparation helper accepts `goalieSnapshotRows` from a trusted upstream read.

**Still required before live automation:** a trusted scheduled read of Supabase rows, fresh pregame observation/identity inputs, a baseline archived before kickoff, a separate append-only capture destination, and end-to-end testing. Do not treat the existing SQL view `core43_shadow_predictions_v1` as an independently frozen forecast archive without checking its underlying provenance.
