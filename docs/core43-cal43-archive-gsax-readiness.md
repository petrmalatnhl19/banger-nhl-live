# CORE43-CAL-43 — Ověření původní predikce a GSAx readiness

Read-only audit 2026-11-17 přibližně 12:29 UTC, NHL game `2026020335`, Edmonton @ Florida. Navazuje na CAL-42, HEAD `ee23794a04d634bd6ec72ce7505de206a32e5967`.

## Výsledek

- Produkční `nhl_prediction_archive`: `core42_away=3.38055896962006`, `core42_home=3.06434482648226`, `core42_predicted_at=2026-11-17T12:15:12.367Z`, `core42_version=banger-core-v4.2-late-goalie`.
- Oficiální schedule snapshot: `kickoff_at=2026-11-18T00:00:00Z`, poslední `fetched_at=2026-11-17T09:36:43.582Z`. Čas predikce před kickoffem; historie neměnnosti a nezávislý podpis nebyly tímto SELECTem prokázány.
- `core43_core42_comparison_readiness` away: Devon Levi, `goalie_id=8482221`, `gsax=2.6000`, `shots_against=267`, `observed_status=projected`, `readiness=not_confirmed`.
- Home: Jacob Markstrom, `goalie_id=8474593`, `gsax=3.6800`, `shots_against=264`, `observed_status=projected`, `readiness=not_confirmed`.
- `core43_confirmed_goalie_matchups`: oba goalie ID a GSAx NULL, `readiness=awaiting_confirmed_starters`.
- `core43_shadow_predictions_v1`: `ready_sides=0` ze 2, `core43_away=NULL`, `core43_home=NULL`, `experiment_status=awaiting_verified_pregame_inputs`; verze `core43-shadow-gsax-v1-heuristic-unvalidated`.
- `core43_game_readiness`: `awaiting_verified_goalie_ids_and_exact_kickoff` (pohled je konzervativní; nezaměňovat za potvrzení absence kickoffu, který je v samostatném schedule snapshotu přítomen).

## Doporučený další bezpečný krok

V 45–75minutovém okně před zápasem (2026-11-17 22:45–23:15 UTC / 23:45–00:15 SEČ) pasivně zkontrolovat potvrzené startery, GSAx, snapshot freshness, CORE 4.2 archival integrity, schválená CAL-07 data a exportní oprávnění. Pokud chybí byť jeden povinný vstup nebo oprávnění, výsledek `not_ready`; nepřidávat oprávnění, nevyvolávat produkční collector, nevyrábět retrospektivní predikci.

Bez zápisu do Supabase, změny Edge Functions, změny produkčního CORE 4.2, merge či deploy. Tento dokument není důkazem kryptografické neměnnosti a nezapíná automatický monitoring.
