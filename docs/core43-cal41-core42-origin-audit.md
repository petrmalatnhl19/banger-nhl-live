# CORE43-CAL-41 — Audit původního CORE 4.2 (read-only)

Audit 16. 11. 2026, PR #230, výchozí HEAD `8f4af662bf50bf1f09d3d8bf56e505d0cc4eb3b5`.

## Ověřená produkční cesta

- Supabase projekt `app-development` (`xxwqeiuyislnoxsmjuul`), aktivní Edge Function `nhl-prediction-collect` verze 26.
- Collector čte NHL schedule, standings a historické zápasy; CORE 4.2 používá archivované CORE 4.1 a advanced baseline, aktuální RotoWire feed, ověření identity brankářů proti NHL roster a historické goalie samples.
- CORE 4.2 se vyhodnocuje pouze při `0 < hoursToStart <= 12`, s kontrolou čerstvosti feedu, jednoznačnosti pozorování obou týmů, identity obou brankářů a minimálně 30 střel proti pro každého; další kontroly ověřují existenci platných předzápasových baseline.
- Při splnění podmínek collector provádí `PATCH /rest/v1/nhl_prediction_archive?game_id=eq.<id>&status=eq.pending&core42_away=is.null&core42_home=is.null` s `core42_away`, `core42_home`, `core42_version`, `core42_factors`, `core42_predicted_at`. Diagnostika zapisuje `CORE42_DIAGNOSTIC`; samotné HTTP 2xx není důkazem změny řádku, pokud není ověřen počet změněných řádků.
- Aktivní `cron.job`: `banger-nhl-collect` každé dvě hodiny v :15 UTC; `banger-nhl-finalize` každou hodinu v :35 UTC. `cron.job_run_details` dokládá úspěch odeslání, nikoliv dokončení collector výpočtu.
- `nhl-prediction-finalize` finalizuje odehrané zápasy a případně ověřuje brankáře; není původním producentem CORE 4.2.

## Edmonton @ Florida, 2026020335

Read-only SQL potvrdilo `status=pending`, `core40_predicted_at=2026-11-13T00:15:34.079Z`, `core41_predicted_at=2026-11-13T00:15:34.182Z`, `advanced_predicted_at=2026-11-13T00:15:33.793Z` a `core42_away/core42_home/core42_predicted_at/core42_version/core42_factors=NULL`.

Plánovaný kickoff dle CAL-37 je `2026-11-18T00:00:00Z`; CORE 4.2 okno začíná `2026-11-17T12:00:00Z`. Před tímto časem absence CORE 4.2 není dokladem selhání. Původní predikce pro tento zápas zatím není doložena; nesmí být nahrazena zpětným výpočtem. Kontrola artefaktů CAL-39 odhalila jen izolovaný ledger a syntetický CAL-14; žádný původní snapshot.

## Bezpečný další postup (není aktivován)

1. Po otevření 12h okna pasivně sledovat `CORE42_DIAGNOSTIC` a `nhl_prediction_archive`; nepouštět collector ručně, neměnit produkční oprávnění ani klíče.
2. Pokud predikce vznikne, ověřit předzápasové `core42_predicted_at`, hodnoty, `core42_factors`, `core42_version`, identitu utkání a nezávislé časové doklady. Záznam bez předzápasového důkazu označit jako nedostatečně doložený.
3. Pro CAL-07 použít pouze schválený konzistentní read-only export všech pěti tabulek, podpis Ed25519, kontrolu asOf/issuedAt, identit a GSAx, v okně 45–75 minut před kickoff. CAL-06 čtecí roli neaktivovat; servisní klíč nepoužívat jako náhradu omezené role.
4. Pro budoucí robustnost připravit izolovaný návrh: verifikace skutečně změněného řádku po PATCH, per-game diagnostika důvodů skip, fail-closed alert na chybějící CORE 4.2 při T−75 min, neměnný předzápasový podpis/otisk a soukromý export. Produkční Edge Function se nesmí měnit bez samostatné revize a schválení.

Tento soubor je pouze dokumentace. Žádný SQL zápis, nasazení, aktivace jobu ani změna výpočtu nebyly provedeny.
