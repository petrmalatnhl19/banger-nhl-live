# CORE43-CAL-48 — CAL-07 preflight, read-only audit

**Scope:** game `2026020335` EDM @ FLA, Draft PR #230, branch `core43-cal-03-dryrun-collector`. All Supabase interactions in this step were SELECT-only. Audit at `2026-11-17 21:09:14 UTC` (22:09:14 CET). Kickoff assumed `2026-11-18 00:00 UTC` (01:00 CET), subject to authoritative schedule recheck at execution.

## Observations

- Archived CORE 4.2: **1** game row. Do not mutate.
- Schedule snapshots: **11** game rows.
- RotoWire observations: **312** game rows.
- Starter evidence: **11** game rows; latest for both teams `confirmed` at `2026-11-17 20:55:01.47394 UTC`, published `20:55:01.391669 UTC`. EDM goalie ID `8482221`, FLA goalie ID `8474593`.
- `nhl_core43_shadow_inputs`: two immutable records captured `2026-11-17 12:15:12.419578 UTC`, each `missing_pregame_starter_evidence`; no historical retroactive upgrade permitted.
- `core43_shadow_predictions_v1`: `ready_sides=0`, `total_sides=2`, `core43_away/home=NULL`, `awaiting_verified_pregame_inputs`. This view represents the original capture, **not** a new CAL-47 revision.
- `nhl_prediction_revisions`: **0** game rows.
- `nhl_core43_shadow_capture_archive`: **0** game rows. Its `game_id` column is text, so use a quoted ID for inspection.
- Grants for four restricted CAL-07 source tables (schedule snapshots, observations, identity map, goalie snapshots): SELECT granted to `postgres` and `service_role`, but no dedicated CAL-06 restricted exporter reader shown. `nhl_prediction_archive` also grants SELECT to `anon` and `authenticated`. These grants **do not prove** the intended authorized export identity can access all five sources.

## Readiness gates

| Gate | State | Reason |
|---|---|---|
| Original CORE 4.2 archived | PASS | 1 row |
| Latest pregame starter evidence | PASS as of audit | both confirmed; verify again at window |
| CAL-47 offline validator tests | PASS | 15/15 in GitHub Actions on commit `3ea5a1ec81df38dadaa566066ed53c9c61bc253b` |
| New separate pregame revision | NOT PRESENT | no revision rows; no authorized capture run |
| CAL-06 dedicated read-only export identity | UNPROVEN | no grant proof for all five sources |
| CAL-07 signed, independently verifiable export | UNPROVEN | no signed artifact verified |

**Overall: NOT_READY** for actual CAL-07 export. Offline proposal validator is not a capture mechanism and does not verify raw snapshot digest, execute authorized source access, or sign Ed25519 packages.

## Window checklist: T−75 to T−45

Target `2026-11-17 22:45–23:15 UTC` / `23:45–00:15 CET` if kickoff remains 00:00 UTC. Recheck kickoff and current time first. Read-only verify five source tables, goalie identity, as-of evidence, source timestamps, GSAx and sufficient shots; ensure publication and verification precede the proposed asOf. Confirm dedicated CAL-06 export role and independent Ed25519 signature verification before any authorized export. Do not use `service_role` as workaround. If any gate is unproven, fail closed and record missing prerequisites. No Supabase write, production modification, scheduled activation, PR merge or deployment.

## Next

CAL-49 should focus on offline provenance/identity checks and signature-verification tests in Draft PR, not on manufacturing an apparently authentic signed export. Keep the original historical snapshot unchanged.
