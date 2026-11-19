# CORE43-CAL-47 — Offline revision validator and regression suite

Scope: Draft PR #230, game `2026020335`. New files:
- `scripts/core43_cal47_offline_revision.py`: pure in-memory validator; no database, network or filesystem writes; returns **offline proposal only** with canonical SHA-256.
- `tests/test_core43_cal47.py`: 15 unit-test cases covering valid revision, deterministic payload, immutable input, temporal checks, missing confirmations, wrong identity, stale/invalid goalie sample, digest and model version.

Run locally (Python 3.10+):
```sh
python -m unittest discover -s tests -p 'test_core43_cal47.py' -v
```

**No execution claim:** these new unit tests were committed but not independently executed in this tool session. GitHub Actions were in progress when checked on commit `74ce537d1c5bf8eec64b42db3397eb7a07a6bdd8`. Existing workflows may not discover the new Python test; verify separately.

The validator enforces `source_prediction_at < as_of < kickoff_at` and a 45–75 minute before kickoff interval, confirmed evidence `published_at <= verified_at <= as_of`, exact game/team/goalie identity, pre-asOf GSAx with >=30 shots, explicit model version and snapshot SHA-256. It does not compute CORE 4.3, sign an export, establish CAL-06 permissions, or authorize any live capture. Snapshot hashes are provided inputs; the prototype does not independently verify them against raw source bytes. Duplicate evidence resolution and freshness threshold require a later design step.

The original T−12h CORE 4.2 and `nhl_core43_shadow_inputs` must remain immutable. Do not backfill confirmed evidence that was published later. A later revision is a separate experimental prediction, not a retroactive correction of the original.

**Next:** verify Python unit tests, then separately inspect the CAL-07 authorized export path and snapshot provenance. At the T−75/T−45 window, perform only approved read-only checks; if evidence or permissions are missing, fail closed. No Supabase writes, production change, merge, deployment or schedule activation.
