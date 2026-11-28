# CORE43-CAL-45 — Izolovaná diagnostika časových snapshotů a potvrzených brankářů

**Kontrola:** 2026-11-17 20:40 UTC / 21:40 SEČ, game ID `2026020335`, Edmonton @ Florida. Výchozí HEAD `2c73d8a0f6056efcbad1a4fd932044ce617df6a6`. Jen SELECT a čtení definic pohledů, žádný zápis do Supabase.

## Výsledek: potvrzení brankářů existuje, shadow pipeline stále NOT_READY

- CORE 4.2 nezměněn: EDM `3.38055896962006`, FLA `3.06434482648226`, `core42_predicted_at=2026-11-17T12:15:12.367Z`, kickoff `2026-11-18T00:00:00Z`.
- Nejnovější RotoWire pozorování: **oba confirmed**, EDM Devon Levi ID `8482221`, FLA Jacob Markstrom ID `8474593`, `observed_at=2026-11-17T19:59:53.654905Z`, `source_snapshot_at=2026-11-17T19:59:53.572942Z`.
- `nhl_core43_starter_evidence`: pro oba týmy existuje `evidence_status=confirmed`, `verified_at=2026-11-17T19:59:53.654905Z`, `source_published_at=2026-11-17T19:59:53.572942Z`. Oba timestampy jsou před kickoffem.
- `core43_confirmed_goalie_matchups`: `ready_for_experimental_core43`, GSAx EDM +2.60 (267 střel), FLA +3.68 (264 střel), `fetched_at=2026-11-17T09:26:35.129504Z`.
- `nhl_core43_shadow_inputs`: existují dva řádky (away/home), oba `readiness=missing_pregame_starter_evidence` navzdory potvrzení v samostatné `nhl_core43_starter_evidence`. `core43_shadow_predictions_v1` agreguje právě readiness z `nhl_core43_shadow_inputs` a vyžaduje `ready_sides=2`; aktuálně 0/2, predikce NULL. **Jde o rozdílný zdroj/stav pipeline, nikoli důkaz, že potvrzení brankářů chybí.** Není prokázáno, proč se materializovaný shadow stav neaktualizoval; žádný backfill se neprováděl.

## Vysvětlení historických GSAx

Read-only `pg_views.definition` potvrzuje:

1. `core43_goalie_experiment_inputs` řeže zdroje podle `core41_predicted_at=2026-11-13T00:15:34.182Z`. Proto vrací starší GSAx +1.21 (EDM, 248 shots) a +1.41 (FLA, 240 shots), s `gsax_fetched_at=2026-11-12T09:24:16.720178Z`. To je legitimní historický as-of CORE 4.1.
2. `core43_core42_comparison_readiness` řeže zdroje podle `core42_predicted_at=2026-11-17T12:15:12.367Z`; vrací +2.60 a +3.68. V té době byl RotoWire status pouze `projected`, proto `not_confirmed` je správné pro **as-of CORE 4.2**. Pozdější potvrzení se nesmí připsat původní predikci.
3. `core43_confirmed_goalie_matchups` používá samostatnou potvrzovací evidenci s `verified_at < kickoff_at` a GSAx `fetched_at <= verified_at`. Proto dnes může být `ready_for_experimental_core43` bez porušení předzápasového času, ale stále to není autorizovaný CAL-07 export.
4. `core43_shadow_predictions_v1` nečte readiness přímo z confirmed matchup view; čte `nhl_core43_shadow_inputs` a vyžaduje oba řádky `readiness='ready'`. Jejich stav zatím zůstal `missing_pregame_starter_evidence`.

## Oprávnění a bezpečnost

- `nhl_core43_starter_evidence` SELECT: `postgres`, `service_role`; veřejná čtecí oprávnění se v kontrole neprokázala.
- `nhl_core43_shadow_inputs` SELECT: `anon`, `authenticated`, `postgres`, `service_role`; tato metadata sama nedokazují použitelnost bezpečné CAL-06 exportní role.
- Neprovádět automatické přepisování `readiness`, ruční označení `ready`, dodatečné přiřazení pozdějšího confirmed ke starému CORE 4.2, ani obcházení CAL-06 pomocí `service_role`.

## Runbook pro T−75 až T−45

Okno `2026-11-17 22:45–23:15 UTC` = **23:45–00:15 SEČ**; kickoff **01:00 SEČ**. Pozor, předzápasové okno je až za cca dvě hodiny od tohoto auditu.

1. Ověřit kickoff a aktuální snapshot. Ověřit, že obě confirmed evidence jsou před kickoffem a obsahují shodná game/team/goalie IDs a zdrojový čas.
2. Zvolit jediný `asOf` v okně a v pěti zdrojových tabulkách vyloučit řádky po `asOf`; validovat jednoznačnost a GSAx `fetched_at <= asOf`.
3. Nezaměňovat as-of CORE 4.1, CORE 4.2 a pozdější potvrzení; explicitně zapsat časové hranice a model version.
4. Read-only ověřit `nhl_core43_shadow_inputs` a příčinu přetrvávajícího `missing_pregame_starter_evidence` oproti evidence table; bez samostatně schválené změny jej neopravovat.
5. Ověřit schválené omezené exportní oprávnění CAL-06, podepisovací mechanismus Ed25519, `asOf/issuedAt`, otisk a nezávislý časový doklad; tyto podmínky zatím nejsou end-to-end prokázány.
6. Jestliže kterýkoli povinný krok selže, **NOT_READY** a žádný export. Nepředstírat původní predikci ani neprovádět backfill.

**Bezpečnost:** žádný Supabase write, GRANT, RLS/Edge Function/CRON change, produkční CORE 4.2 change, merge ani deploy. Jediná změna je tento dokument v Draft PR #230.
