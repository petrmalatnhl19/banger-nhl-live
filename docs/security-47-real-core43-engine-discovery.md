# SECURITY-47 — actual CORE 4.3 source located; offline integration

Date: 2026-11-16. Follow-up to SECURITY-46. Read-only cross-branch discovery; no production changes.

## Verified code locations

- PR #34, branch `feature/core43-engine-v0-dry-run`: `scripts/core43_research_engine_v0.cjs`, exports `computeCore43`; deterministic research engine with shot share, xG share, PP/PK, rest and goalie GSAx/60. Returns `calibrated:false`, `persistable:false`, `production:false`. Not the approved production scoring model.
- Current security branch: `scripts/core43_gsax_sensitivity.cjs`, exports `calculateShadow`; real experimental goalie sensitivity computation, `calibrated:false`, `production:false`. Inputs: baseline, both goalie snapshots, as-of time, optional hypothetical coefficient.
- Current security branch: `scripts/core43_shadow_compute.cjs` integrates archived candidate audit and GSAx sensitivity.
- CORE43-CAL PR #230 branch `core43-cal-03-dryrun-collector`: `scripts/core43_cal03_capture_plan.cjs`, exports `plan`; calls `core43_two_goalie_pregame_shadow.cjs`, computes four uncalibrated coefficients, rejects stale input, `writeEnabled:false`.

## Added isolated integration test

`scripts/test_security47_core43_real_engine.cjs` calls the actual existing `calculateShadow` implementation with synthetic frozen pregame inputs. Tests deterministic reruns, goalie input changes affecting outputs, original immutability by non-mutation, missing and post-cutoff goalie data, live status, actual start before cutoff and unknown start. Runs in offline security CI; does not use credentials, HTTP, Supabase or production predictions.

The trusted game status and actual-start checks in this test are a **test harness**, not a deployed validation service. It cannot attest that external evidence publication timestamps are genuine.

## Release gate

This is **real code integration, but only with the existing uncalibrated GSAx sensitivity sub-engine**. It does not validate a calibrated end-to-end CORE 4.3 production engine or measured accuracy. No merging of PR #230, no changes to CORE 4.2, no production database writes, no scheduler activation. **NO-GO**.
