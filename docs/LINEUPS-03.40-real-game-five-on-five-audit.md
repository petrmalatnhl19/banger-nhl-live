# LINEUPS-03.40 – Real-game 5v5 reconstruction audit

Source: GitHub Actions `Frontend smoke checks` run 44909798169, job 136862974883, commit `370c5bc4d83971cc0b344c69794c15bd15fae27e`, game 2026020335 (EDM–FLA), NHL shiftcharts API. All counts are diagnostic, **not independently verified**.

## Input and coverage

- 827 NHL shiftchart rows, 813 accepted by base parser; 14 rejected.
- 206 candidate-strength intervals spanning 3018 seconds, of which 171 candidate 5v5 intervals span 2457 seconds (40:57).
- EDM: 2445 eligible 3F+2D seconds, 12 excluded nonstandard seconds, 49 distinct forward trios, 14 defence pairs.
- FLA: 2412 eligible 3F+2D seconds, 45 excluded nonstandard seconds, 46 distinct forward trios, 15 defence pairs.
- Coverage of candidate 5v5 intervals: EDM 99.51%; FLA 98.17%. **These percentages do not represent verified full-game coverage.**

## Most frequent observed candidate combinations

| Team | Kind | Players | Observed seconds |
|---|---|---|---:|
| EDM | forward | Z. Hyman – C. McDavid – C. Dach | 547 |
| EDM | forward | L. Draisaitl – K. Kapanen – V. Podkolzin | 529 |
| EDM | defence | M. Ekholm – E. Bouchard | 737 |
| EDM | defence | C. Murphy – R. Shea | 677 |
| FLA | forward | S. Reinhart – E. Luostarinen – A. Lundell | 511 |
| FLA | forward | S. Bennett – M. Tkachuk – B. Tkachuk | 489 |
| FLA | defence | A. Ekblad – G. Forsling | 744 |
| FLA | defence | S. Jones – N. Mikkola | 691 |

## Comparison against LINEUPS-03.36 benchmark (not apples-to-apples)

The independent reference records EDM Hyman–McDavid–Dach 663s, Draisaitl–Kapanen–Podkolzin 632s, Ekholm–Bouchard 896s, FLA Bennett–Tkachuk–Tkachuk 617s, and Ekblad–Forsling 933s.

| Combination | Candidate observed | Reference | Reference minus candidate |
|---|---:|---:|---:|
| EDM Hyman–McDavid–Dach | 547 | 663 | 116 |
| EDM Draisaitl–Kapanen–Podkolzin | 529 | 632 | 103 |
| EDM Ekholm–Bouchard | 737 | 896 | 159 |
| FLA Bennett–M. Tkachuk–B. Tkachuk | 489 | 617 | 128 |
| FLA Ekblad–Forsling | 744 | 933 | 189 |

**Do not score these differences as prediction errors.** The reconstructed values cover only candidate intervals; the reference may use another strength/coverage definition. The benchmark also uses repeated surname Tkachuk; player IDs and full names must be used to avoid conflating distinct players.

## Next acceptance criteria

1. Define identical eligible game-time/strength scope for both sources.
2. Attribute missing seconds to interval gaps, strength ambiguity, or roster/position issues.
3. Verify reference lineup identities and source provenance independently.
4. Compare only scope-aligned results, with explicit missing-data intervals and no automatic publication.
5. Keep `verifiedUnits:false` and `publishable:false` until independent evidence is sufficient.

No changes to CORE, Supabase, production or public lineup gate.
