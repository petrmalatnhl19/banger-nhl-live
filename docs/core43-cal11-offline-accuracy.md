# CORE43-CAL-11 vyhodnocení přesnosti

## Stav archivu k 15. listopadu 2026

| Zdroj | Zjištění z auditu pouze pro čtení |
| --- | --- |
| `nhl_prediction_archive` | 49 dokončených zápasů s vyplněnými očekávanými góly CORE 4.2, časem predikce a výsledkem. Jde o kandidáty před párováním a kontrolou času. |
| `nhl_core43_shadow_capture_archive` | Jeden experimentální záznam vytvořený a archivovaný před začátkem. Obsahuje pouze koeficient `0.02`. |
| `nhl_prediction_revisions` | Nula experimentálních revizí `core43_shadow` typu `shadow`. |
| Společný historický vzorek pro všech pět porovnávaných řad | Nula zápasů. |

### Historické srovnání

| Model | Společné zápasy | Brier | Log loss | Úspěšnost tipu vítěze |
| --- | ---: | ---: | ---: | ---: |
| CORE 4.2 | 0 | N/A | N/A | N/A |
| CORE 4.3 · 0 | 0 | N/A | N/A | N/A |
| CORE 4.3 · 0.005 | 0 | N/A | N/A | N/A |
| CORE 4.3 · 0.02 | 0 | N/A | N/A | N/A |
| CORE 4.3 · 0.03 | 0 | N/A | N/A | N/A |

**Jediný doložený případ mimo společný vzorek.** Zápas `2026020293`, Tampa Bay proti Buffalu. Archivovaný CORE 4.2 očekával přibližně 3,543 ku 3,160 gólu, varianta `0.02` očekávala 3,550 ku 3,163. Oba výstupy ukazovaly na Tampu Bay. Experimentální záznam byl uložen 11. listopadu ve 22:14 českého času před skutečným začátkem 12. listopadu v 01:08. Tampa Bay vyhrála 8:3. Jeden shodný tip neumožňuje posoudit přesnost modelů. [Oficiální zápis NHL](https://www.nhl.com/scores/htmlreports/20262027/GS020293.HTM) · [NHL boxscore](https://api-web.nhle.com/v1/gamecenter/2026020293/boxscore)

### Význam jednotlivých výstupů

CORE 4.2 v produkčním archivu ukládá očekávané góly hostů a domácích a čas predikce. Experimentální CORE 4.3 z CAL-03 a CAL-07 používá tento zmrazený základ a mění očekávané góly podle archivovaného GSAx obou brankářů. Koeficienty jsou `0`, `0.005`, `0.02` a `0.03`. Koeficient nula reprodukuje základ po zaokrouhlení na tři desetinná místa. Žádná z prohlédnutých archivních struktur těchto řad neposkytla historickou pravděpodobnost výhry včetně prodloužení a nájezdů. Hodnota očekávaných gólů se na pravděpodobnost nepřepočítává. [Plánovač CAL-03](../scripts/core43_cal03_capture_plan.cjs) · [Výpočet citlivosti GSAx](../scripts/core43_gsax_sensitivity.cjs)

## Jak vyhodnotit vlastní archiv offline

```bash
node scripts/core43_cal11_evaluate.cjs predictions.json trusted-pregame-evidence.json outcomes.json --markdown
```

Každý vstup je JSON pole. Bez `--markdown` získáte JSON report se seznamy zápasů pro každý společný jmenovatel. Použijte kanonické časové značky UTC s milisekundami v predikcích a dokladech. Čas v NHL boxscore může být uveden bez milisekund.

- **Predikce** obsahuje `origin`, `gameId` jako desetimístný řetězec, `kickoffAt`, `frozenAt`, `awayTeam`, `homeTeam`, objekt `core42` a pole `variants`. Každá predikce má `predictedAt`, očekávané góly `away` a `home`. Varianty mají také `coefficient` a `inputAsOf`. Volitelnou dvojici `homeWinProbability` a `probabilityTarget` použijte pouze pro archivovanou pravděpodobnost cíle `home_win_including_ot_so`.
- **Předzápasový doklad** vyžaduje `gameId`, `sha256` z UTF-8 `JSON.stringify(prediction)`, `observedAt` a `archiveRef`. Získejte jej z nezávislé důvěryhodné evidence, která existovala před zápasem. Evaluátor kontroluje shodu otisku a času. Zdroj dokladu a jeho hodnověrnost musí ověřit ten, kdo data předává. Vytvoření otisku až po zápase nevytváří historický důkaz. Samotný SQLite záznam z CAL-08 až CAL-10 nemá předzápasový doklad k tomuto přesnému formátu.
- **Výsledek** obsahuje `origin`, přesnou URL zdroje `sourceUrl` a uloženou odpověď `boxscore` z oficiálního NHL API pro dané ID. U historické řady přidejte `officialStart` s `at` a `url` oficiálního zápisu NHL, z něhož jste přepsali skutečný začátek. Použijte pouze ověřené soubory z těchto zdrojů. Evaluátor síťově nic nestahuje a samotná URL nedokládá, že se obsah souboru shoduje se zdrojem. Pro simulace použijte `sourceUrl: "fixture"`.

Řada `historical` vyžaduje důkaz před plánovaným i skutečným začátkem. `simulation` a `recomputed` mají samostatné jmenovatele a nikdy se nesčítají s archivními výsledky. U zpětného výpočtu je třeba před importem doložit časovou dostupnost jeho vstupů. Evaluátor predikce sám nevytváří. Odděluje vstup s predikcemi od konečných výsledků, v predikcích odmítá neznámá pole a kontroluje posloupnost času základní predikce, vstupů, odhadu a zmrazení. Všechny varianty musí sdílet čas vstupů i výpočtu. Pár musí mít shodné ID, týmy, plánovaný začátek a konečný stav NHL. Při duplicitě se nerozhoduje podle pořadí souboru. Chybějící koeficient vyloučí zápas pro všech pět porovnávaných řad.

Brier a log loss používají stejnou podmnožinu zápasů s platným cílem a pravděpodobností pro všech pět řad. Pro Brier se průměruje `(p − y)²`. Pro log loss se průměruje záporný přirozený logaritmus pravděpodobnosti skutečného výsledku, s dolní mezí `1e-15` pro pravděpodobnost nula. Výběr vítěze používá stranu s vyššími očekávanými góly. Pokud kterákoliv řada tipuje remízové skóre, vynechá se daný zápas ze jmenovatele této metriky pro všechny řady. Skutečný výsledek používá oficiální konečné skóre včetně prodloužení a nájezdů. Žádná metrika se nevykazuje, pokud její společný vzorek nemá žádný zápas.

Pro výběr koeficientu a jeho následné hodnocení vyhraďte různé časové úseky. Testy používají izolované příklady a známé kontrolní hodnoty. Neposkytují odhad přesnosti na NHL.
