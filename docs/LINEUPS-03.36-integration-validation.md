# LINEUPS-03.36 — independent game benchmark gate

Game: 2026020335 (Edmonton @ Florida), 17 November 2026.

## Evidence and scope
- Independent published 5v5 comparison: https://hockeyweights.com/game/2026020335/
- NHL raw shiftcharts: https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId%3D2026020335
- The benchmark reports EDM Hyman–McDavid–Dach 11:03; Draisaitl–Kapanen–Podkolzin 10:32; Ekholm–Bouchard 14:56; FLA Bennett–Tkachuk–Tkachuk 10:17; Ekblad–Forsling 15:33.
- Direct NHL shiftcharts payload could not be independently retrieved during this implementation. No raw-shift coverage counts or measured agreement are claimed.

## Implemented
- `scripts/lineups_03_36_benchmark.cjs`: strict comparison of independently computed 5v5 lines with the external benchmark; missing source rows, roster verification, strength verification, malformed or duplicate observations fail closed.
- `tests/lineups-03-36-benchmark.test.cjs`: regression fixtures cover agreement, mismatch, missing evidence, duplicate lines, order-insensitive names and repeated surnames.
- Frontend smoke CI now runs the tests. **These are synthetic regression inputs with real benchmark targets, not real-game accuracy results.**
- All comparison outputs remain `publishable:false` and `verifiedUnits:false`. No PP1/PP2/PK1/PK2 release.

## Remaining blockers / next actions
1. Retrieve and archive authentic NHL shiftcharts, boxscore and play-by-play payloads for this game with provenance and timestamps.
2. Verify both teams' complete shifts, rejected rows, game clock and player roster IDs. Record measured coverage and failure reasons.
3. Independently classify every second as 5v5/PP/PK/other, including penalties and pulled goalie.
4. Derive **forward trios and defence pairs at 5v5** from raw shifts; the existing five-skater candidate pipeline is not directly equivalent to these benchmarks.
5. Pass genuine derived lines into `compareBenchmark`; report discrepancies and source-specific limitations. Do not use benchmark figures as observed inputs.
6. Review source licensing before public display and independently verify special teams before enabling publication.

## Release decision
NO-GO for verified 5v5/PP/PK publication. CI success proves regression behavior only, not correctness of real-game lineup reconstruction.

## Verified historical GitHub Actions run — actual NHL data FOUND (2026-11-20)
**Correction to earlier claim above:** the NHL endpoint was inaccessible from the assistant's web/container environment, but **the existing GitHub Actions runner did successfully fetch it**. Evidence: workflow `Frontend smoke checks`, run ID `44834218464`, job ID `136626415890`, log at 2026-11-20 23:06 UTC, `scripts/lineups-03-real-game-diagnostic.cjs 2026020335`. The report below is transcribed from that real execution, not from a synthetic fixture.

- NHL shiftcharts HTTP 200, reportedTotal/rawRows **827**, 38 players, team IDs 13 (Florida) and 22 (Edmonton), periods 1–3.
- Shift parser: **813 accepted / 14 rejected**. Rejections: 7 non-shift events, 7 long shifts (over 180s). Roster audit identifies all 7 long shifts as goalie shifts, zero skaters. Separate roster-aware audit reports 812 skater shifts and 8 goalie shifts; these figures belong to different processing stages and should not be added as though they were disjoint parser outputs.
- On-ice occupancy: EDM 5 skaters 3360s / 4 skaters 240s; FLA 5 skaters 3171s / 4 skaters 180s / 3 skaters 101s / 6 skaters 148s. These are per-team counts, **not confirmed 5v5 time**.
- Event strength agreement: **271 matched, 10 mismatched, 4 skipped** (281 compared). All 10 mismatches were near shift boundaries; event evidence resolves 10 only at the preceding second, **not** verified intervals.
- Strength interval candidates: 206, 3018 seconds total; 5v5 2457s, 4v5 213s, 5v4 153s, 5v6 126s, 5v3 69s.
- Candidate PP seconds: EDM 222, FLA 213. These are partial candidate intervals and do not equal independently validated full-game PP totals.
- `publicSpecialTeams` remains `unavailable`; `verifiedUnits:false`.
- Goal-strength diagnostic reports 2 potential minor-termination goals with **no candidate strength at goal second**; no PP-goal/penalty termination verification.
- Existing real-game pipeline produces **five-skater combinations**, not the benchmark's separate forward trios and defence pairs. Thus there is still **no apples-to-apples comparison** with the independent HockeyWeights 5v5 benchmark.

### Next reproducibility requirement
Save an auditable, appropriately licensed minimal fixture or machine-readable summary from a GitHub Actions run, including provenance, then implement a 5v5-only forward-trio/defence-pair extractor and compare actual derived seconds. Do not inject benchmark values as observations or mark the public gate verified.
