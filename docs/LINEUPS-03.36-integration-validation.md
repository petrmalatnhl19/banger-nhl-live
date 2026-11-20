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
