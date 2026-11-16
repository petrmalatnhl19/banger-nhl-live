# CORE43-CAL-42 — Pasivní předzápasová kontrola CORE 4.2

Datum kontroly: 2026-11-16. Navazuje na CAL-41, výchozí HEAD `56a709b33b350a154809fbe92135996effaade33`.

## Zápas a časová okna

- NHL game ID `2026020335`, EDM @ FLA, `kickoff_at=2026-11-18T00:00:00Z` (01:00 SEČ).
- CORE 4.2 se může počítat nejdříve `2026-11-17T12:00:00Z` (13:00 SEČ), protože produkční collector používá podmínku `0 < hoursToStart <= 12`.
- Aktivní produkční cron `banger-nhl-collect` má výraz `15 */2 * * *`; ověřit časové pásmo plánovače před interpretací konkrétního běhu. `banger-nhl-finalize` má `35 * * * *`.
- CAL-07 vyžaduje export v okně 45–75 minut před zápasem (2026-11-17T22:45:00Z až 23:15:00Z), s konzistentním čerstvým zdrojem. To není totéž co 12h okno produkčního výpočtu.

## Ověřené read-only skutečnosti

- `nhl_prediction_archive`: `game_id=2026020335`, `status=pending`, `core42_away=NULL`, `core42_home=NULL`, `core42_version=NULL`, `core42_predicted_at=NULL`, `core42_factors=NULL`.
- `nhl_core43_schedule_snapshots`: nejnovější pozorovaný záznam `2026-11-16T10:24:21.849307Z`, kickoff `2026-11-18T00:00:00Z`, zdroj `official_nhl_schedule`.
- `cron.job`: collect a finalize aktivní; posledních pět kontrolovaných `cron.job_run_details` pro collect má `status=succeeded`, což potvrzuje úspěch SQL naplánovaného HTTP požadavku, nikoli úspěšný CORE 4.2 výpočet.

## Kontrolní postup pro další skutečné spuštění (bez aktivace)

1. Po začátku 12h okna read-only ověřit `core42_away/home`, `core42_predicted_at`, `core42_version`, `core42_factors` pro game ID; nevyvolávat collector ručně.
2. Pokud NULL přetrvá, prověřit `CORE42_DIAGNOSTIC` v Edge Function logu a přidružené HTTP response logy; rozlišit `feed_missing_or_stale`, `goalie_match_missing_or_ambiguous`, `goalie_roster_mismatch_or_unavailable`, `insufficient_goalie_sample`, `missing_or_invalid_pregame_snapshot`, `write_accepted`, `CORE 4.2 patch failed` a skutečně potvrzený řádek.
3. Pokud je záznam přítomen, ověřit `core42_predicted_at < kickoff_at`, shodu EDM/FLA, číselné hodnoty, verzi, faktory a neměnnost. Neodvozovat důkaz předzápasového původu pouze z okamžiku následného čtení.
4. V CAL-07 okně samostatně vyhodnotit kompletnost všech pěti schválených vstupních tabulek, GSAx, čerstvost a oprávnění; žádné obcházení CAL-06 role ani produkční zápis.
5. Pokud zdroje či oprávnění chybí, pilot označit jako `not_ready` a přesunout na další budoucí utkání. Nevytvářet zpětně predikci označenou jako původní.

## Bezpečnost a stav

Pouze pasivní read-only kontrola a dokumentace v Draft PR #230. Žádná produkční změna CORE 4.2, Supabase zápis, nové oprávnění, aktivace exportu, merge ani deploy. Kontrola není automatický monitor a sama nevytváří nové předzápasové záznamy.
