# CORE Accuracy Lab 01 – audit a výsledky pilotu

Ověřeno 16. listopadu 2026 v repozitáři BANGER NHL LIVE. Výchozí `main` byl `909797628a7c934a581ac1e57ef6c4f62d08cd3e`. Pilotní [PR #230](https://github.com/petrmalatnhl19/banger-nhl-live/pull/230) byl otevřený jako Draft na `58ebed13f2bf5ae932729bf5a46eb05e54387051`. Na tomto SHA prošlo pět PR workflow. Historickou generálku Dallasu dokumentuje pilotní větev. Proběhla po utkání se syntetickými předzápasovými vstupy a nezávislou časovou kontrolou, která záznam odmítla pro historické použití. [Běhy Actions](https://github.com/petrmalatnhl19/banger-nhl-live/actions?query=branch%3Acore43-cal-03-dryrun-collector) · [CAL-34](https://github.com/petrmalatnhl19/banger-nhl-live/blob/58ebed13f2bf5ae932729bf5a46eb05e54387051/docs/core43-cal34-dallas-rehearsal.md)

## Implementace a reprodukovatelnost

| Model | Skutečná podoba | Historická reprodukovatelnost |
| --- | --- | --- |
| CORE 4.0 | Varianta serverového sběrače `nhl-prediction-collect`. Vážený součet zmrazených komponent xG 5v5 (40 %), brankáři (25 %), speciální týmy (20 %) a forma (15 %). Přítomné váhy se normalizují. | Součet z uložených vstupů reprodukován u 66 z 66 skórovaných archivních řádků. Samostatný běh od surových předzápasových dat společně se zbylými modely nelze z repozitáře a dostupných dat provést. |
| CORE 4.1 | Varianta stejného sběrače a váhové struktury. Kvalitativní kontrola při chybějících nebo slabých brankářských datech vynechá brankářskou složku a přepočítá váhy. | Součet přijatých komponent reprodukován u 66 z 66 řádků. Historické rozhodnutí kvalitativní kontroly a vytvoření všech vstupů od surových dat nelze nezávisle zopakovat. |
| CORE 4.2 | Pozdní varianta stejného sběrače. Archivované faktory potvrzují základ z nebrankářských komponent 4.1, až 12hodinové okno a zdroj RotoWire doplněný o NHL vzorek identifikovaného brankáře. | 54 předzápasových výstupů s archivním časem, metodou, stářím feedu a stavy brankářů. Chybí kompletní zmrazené zdrojové snímky a jednotlivé časy dostupnosti. Historický přepočet není doložen. |
| CORE 4.3 | Experimentální moduly, nikoli samostatný produkční systém. `core43_gsax_sensitivity.cjs` upravuje zmrazenou 4.1 podle GSAx soupeřova brankáře. Pilot CAL-03 navrhuje alternativní varianty nad 4.2. Jsou k dispozici samostatně spustitelné experimentální funkce, které potřebují předem připravené vstupy a základní predikci. | Žádný ověřený předzápasový výstup v tomto vzorku. Tabulka revizí odmítla veřejný GET a hlavní archiv nemá sloupce `core43_*`. Revize v neveřejném archivu ani aktuální nasazenou verzi serverového sběrače se nepodařilo nezávisle potvrdit. |

Architekturu 4.0–4.2 popisuje dřívější audit verzovaných Edge Functions. Výstupy, verze, metody a deklarované faktory byly v této etapě ověřeny přímo v dostupných řádcích. Kód aktuální nasazené Edge Function v kontrolovaném git stromu chybí. [Audit produkčních vzorců](../PREDICTION_INPUT_AUDIT_2026-11-07.md) · [Mapa sběrače](../docs/core43-production-collector-map.md) · [GSAx výpočet](../scripts/core43_gsax_sensitivity.cjs) · [CAL-03 plán](https://github.com/petrmalatnhl19/banger-nhl-live/blob/58ebed13f2bf5ae932729bf5a46eb05e54387051/scripts/core43_cal03_capture_plan.cjs)

## Zdroje a existující nástroje

| Zdroj nebo nástroj | Dostupnost a použití |
| --- | --- |
| NHL Score, Boxscore a Game Summary | Veřejné výsledky, skuteční brankáři a plánované i skutečné začátky. Slouží k identitě zápasu, časové kontrole a vyhodnocení. Sběrač používá stávající knihovní funkci pro NHL JSON a identifikaci skutečných brankářů. |
| `nhl_prediction_archive` a `nhl_core43_public_schedule_evidence` | Veřejně čitelné přes stávající konfiguraci aplikace. Archiv obsahuje verzi, predikované skóre, čas výstupu a faktory. V pilotu bylo dostupných 80 archivních řádků ze 100 zápasů. |
| `nhl_prediction_revisions`, `nhl_core43_shadow_capture_archive` | Experimentální revize a append-only archiv. Existující vyhodnocovací a diagnostické nástroje čtou určená data. Tento veřejný běh neměl oprávnění k revizím. [Dokumentace archivu](../docs/core43-archive-deployment-verification.md) |
| `lineups_archive.json`, `starting_goalies.json`, `rotowire_goalies.json`, `nhl_goalies.json` | Týmové archivy a průběžné snímky sestav a brankářů. Přítomnost souboru nebo datum poslední aktualizace nestačí k přiřazení všech vstupů ke konkrétní predikci. Sběr sestav používá postupy pro NHL a Daily Faceoff. |
| RotoWire a MoneyPuck | RotoWire dodává projekce a potvrzení. MoneyPuck vstupuje do experimentálního GSAx. Archivované GSAx mají vlastní adaptéry a kontrolu `fetched_at` a `created_at`. Aktuální sezonní snímek se na minulý zápas nepoužil. [GSAx adapter](../docs/core43-existing-gsax-snapshot-adapter.md) |
| `core-performance.js`, `engine-lab.js`, `model-input-audit.js` | Produkční přehledy přesnosti, gólových chyb a diagnostik z archivu. Nový dashboard je samostatný a tyto moduly se nemění. |
| `core43_scheduled_accuracy.cjs`, `core43_paired_evaluation.cjs`, `evaluate_core43_archive.cjs` | Existující MAE, RMSE, tip vítěze 4.1/4.2 a párování experimentálních revizí. Dřívější gólový výpočet se porovnává regresním testem na společném cíli. Nová laboratoř přidává samostatné výsledky po 60 minutách, odstranění nájezdového gólu pro cíl „góly ze hry“, striktní časové páry, nezávislý výsledek NHL a metriky pravděpodobnosti jen při jejich doložení. |

## Výsledek

Výběr byl stanoven podle plánu před čtením kterékoliv predikce. Obsahuje **100 skutečných utkání** NHL ze zápasových dnů **1.–15. listopadu 2026**. Časová hranice byla 16. listopadu v 09:00 SEČ. Výsledky zahrnují 77 zápasů dohraných v základní době, 14 v prodloužení a 9 v nájezdech. Oficiální začátek a oba skuteční startující brankáři jsou doloženi pro všech 100 zápasů. Například FLA–DAL (2026020327) skončil 1:2 v prodloužení po výsledku 1:1 v základní době. [NHL Game Summary](https://www.nhl.com/scores/htmlreports/20262027/GS020327.HTM) · [NHL boxscore](https://api-web.nhle.com/v1/gamecenter/2026020327/boxscore)

| Model | Vyhodnoceno | Odvozený tip vítěze | Popisný 95% interval | MAE hosté | MAE domácí | MAE na tým |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CORE 4.0 | 66 | 40/66 · 60,6 % | 48,5–71,5 % | 1,414 | 1,365 | 1,3895 |
| CORE 4.1 | 66 | 40/66 · 60,6 % | 48,5–71,5 % | 1,414 | 1,364 | 1,3887 |
| CORE 4.2 | 54 | 34/54 · 63,0 % | 49,6–74,6 % | 1,460 | 1,432 | 1,4456 |
| CORE 4.3 | 0 | — | — | — | — | — |

Rozdílné jmenovatele v této tabulce jsou pokrytí archivu. Poměr pro CORE 4.2 se vztahuje pouze k jejímu dostupnému vzorku s ověřeným časem predikce a neúplnou historií vstupů. Tip je odvozený z vyššího gólového odhadu a je hodnocen proti konečnému vítězi. Archiv žádného z posuzovaných modelů neposkytl doloženou pravděpodobnost výhry ani tip určený pro výsledek po 60 minutách. Brier, log loss, kalibrace a úspěšnost po 60 minutách jsou v reálném pilotu prázdné.

| Pár | Shodná utkání | Shodný informační čas | MAE v páru | Úspěšnost v páru |
| --- | ---: | ---: | ---: | ---: |
| 4.0 a 4.1 | 66 | 0 | 1,3895 / 1,3887 | 40/66 / 40/66 |
| 4.0 a 4.2 | 54 | 0 | 1,4460 / 1,4456 | 34/54 / 34/54 |
| 4.1 a 4.2 | 54 | 0 | 1,4450 / 1,4456 | 34/54 / 34/54 |

Vliv jednotlivých faktorů z dostupného vzorku nelze odhadnout samostatně. Domácí výhoda je doložena v historickém auditu základní komponenty, ale chybí protějšek s vypnutým faktorem ze stejného snímku. Brankářské stavy 4.2 obsahují 14 deklarovaných potvrzení a 94 projekcí za obě strany. Chybí jednotlivé časové doklady a kontrolní varianty stejného výpočtu. Únavu a absence v experimentálních modulech lze zkoumat až s kompletními zmrazenými vstupy a doklady jejich dostupnosti. [Experimentální vstupy](../core43-inputs.js) · [Audit zapojení](../docs/core43-wiring-audit-2026-11-10.md)

## Stav a CORE-ACCURACY-02

- **Hotovo.** Audit repozitáře, výběr 100 skutečných utkání, lokální read-only sběr, kontrola identity a času, skórování archivovaných predikcí, samostatný dashboard, lokální auditní JSON, regresní testy a PR workflow.
- **Prototyp.** Výpočet pravděpodobnostních metrik a samostatně označených simulací ověřují pouze regresní vstupy. Skutečný pilot neobsahuje simulace. Přehrání váženého součtu 4.0/4.1 slouží ke kontrole archivované predikce.
- **Neověřitelné v této etapě.** Kompletní historické spuštění 4.0–4.3 nad stejným snímkem a časem, dostupnost všech vstupů CORE 4.2, reálná kalibrace, izolovaný vliv faktorů a pořadí modelů.
- **CORE-ACCURACY-02.** Uzamknout budoucí společný okamžik sběru, verzi modelů a očekávané cíle. Před zápasem uchovat stejné ověřené zdrojové snímky včetně stavu obou brankářů, historické formy, odpočinku a absencí. Pro CORE 4.3 použít schválený pilot se skutečnou nezávislou časovou evidencí. Předem stanovit chronologicky oddělené validační období a porovnat modely i varianty s jedním vypnutým faktorem na identické množině. Změnu produkčního modelu posoudit až po samostatné validaci s párovým intervalem zohledňujícím hrací dny.
