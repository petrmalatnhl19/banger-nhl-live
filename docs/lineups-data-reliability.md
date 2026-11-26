# Sestavy a speciální týmy — datová spolehlivost

Ověření 26. 11. 2026 na základu `f9027259`. Integrace používá poslední týmové projekce dostupné na hlavní větvi, soupisku konkrétního zápasu a u dohraných zápasů také hráče na ledě při jednotlivých vhazováních.

## Původní PR #385

Git potvrdil head `a3701aa5`, 248 commitů proti společnému předku, odstup 53 commitů, 119 souborů a +2 549/−5 řádků. GitHub uvádí otevřený neslučitelný Draft. Třícestný pokus nad oběma SHA našel obsahový konflikt pouze v `index.html`. Převzetí celé staré verze by ohrozilo novější kód detailu zápasu. Na main už jsou samostatné záložky projekcí a soupisek, vykreslování útoků a obran, fallback na klubovou soupisku i boxscore.

Z 119 souborů připadá 56 na scripts (55 výzkumných a jeden browser smoke), 57 na tests, čtyři na dokumentaci, jeden na workflow a jeden na aplikaci. Výzkumný řetězec vede od příjmu střídání přes obsazenost a tresty k intervalům, kandidátním kombinacím a pokusům dopočítat mezery. Na jeho konci je veřejná pojistka, která jednotky nepublikuje. Samotné testy této větve používají také syntetické vstupy. Do integrace přešly ovládací prvky a mobilní scénář. Nový malý adaptér pro oficiální zápis vhazování se obejde bez výzkumného řetězce. Historické diagnostiky, kandidátní jednotky, odhady hranic a jejich workflow zůstávají v [PR #385](https://github.com/petrmalatnhl19/banger-nhl-live/pull/385).

## Co fanoušek vidí

- **Projekce** používají zdroj, datum a dostupné trojice/dvojice z hlavní větve. V souboru lineups.json bylo 31 klubů, 117 útočných řad, 91 obranných dvojic a žádná projekce přesilovky. Osm klubů mělo neúplné formace. Se záložními zdroji našla kontrola formace pro 32 klubů, z toho 0 mělo zveřejnění v posledních 36 hodinách podle existujícího kontrolního skriptu. Jde o poslední týmovou projekci. Historickou předzápasovou přesnost vůči těmto 11 zápasům z ní nelze vyhodnotit.
- **Soupiska** používá výhradně boxscore otevřeného zápasu. Před utkáním a během něj aplikace počká s pozorovanými formacemi na konečný zápis.
- **Vhazování** používají hráče uvedené ve sloupcích hostů a domácích v oficiálním reportu NHL PL. Adaptér spojuje číslo utkání a datum, jednoznačný čas vhazování v dané třetině, tým, číslo dresu, jméno a hráčské ID z boxscore a PBP. Ověřuje počet hráčů, přítomnost obou brankářů a totožnost obou účastníků buly. Stejný čas s více buly v PBP, chybějící identita, jiný počet bruslařů nebo odvolaný brankář vedou k vynechání. Na 5v5 se trojice a dvojice vypíší u složení 3F+2D. V PP/PK se zobrazují bruslaři ve chvíli vhazování. Číslo jednotky nelze z tohoto pozorování určit.
- **Společný čas** zůstává mimo veřejné výstupy. Čas vedle sestavy je čas na hodinách při buly. Chyba nebo absence reportu ponechá veřejnou soupisku funkční.

## Validace 11 zápasů NHL z 17. listopadu

Všechny zápasy byly dohrané. Vstupy pro každý řádek lze dohledat dosazením gameId do NHL gamecenter boxscore, landing a play-by-play, do HockeyWeights a posledních šesti číslic do sezonních reportů NHL PL, TV a TH. JSON shiftcharts v tomto běhu pro všech 11 zápasů vrátil HTTP 200 s prázdným polem. Položky TV a TH jsou oficiální výkazy začátků a konců střídání hostů a domácích.

| Game ID | Hosté–domácí | Přijatá buly / všechna PBP | 5v5 buly | PP buly hosté/domácí | Shodné týmové sestavy / zkontrolované | Kandidátní sekundy 5v5 / celý zápas | Prázdná branka (s) | Shoda časů HockeyWeights / řádky | Max. absolutní odchylka (s) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026020333 | LAK–BOS | 46/59 | 40 | 2/4 | 92/92 | 3059/3600 | 61 | 6/14 | 30 |
| 2026020334 | WSH–TBL | 44/52 | 42 | 1/1 | 88/88 | 3342/3600 | 18 | 5/13 | 17 |
| 2026020335 | EDM–FLA | 50/51 | 41 | 4/5 | 100/100 | 2931/3600 | 148 | 3/14 | 26 |
| 2026020336 | CBJ–NYI | 51/52 | 48 | 0/3 | 102/102 | 3343/3600 | 33 | 4/13 | 19 |
| 2026020337 | BUF–PHI | 38/44 | 32 | 3/3 | 76/76 | 2944/3600 | 133 | 6/14 | 15 |
| 2026020338 | TOR–CHI | 51/51 | 41 | 6/4 | 102/102 | 2909/3600 | 15 | 4/14 | 44 |
| 2026020339 | ANA–STL | 53/57 | 44 | 5/4 | 106/106 | 3011/3600 | 101 | 6/13 | 19 |
| 2026020340 | NSH–MIN | 60/60 | 46 | 5/9 | 120/120 | 3030/3600 | 0 | 3/14 | 36 |
| 2026020341 | OTT–WPG | 41/50 | 36 | 5/0 | 82/82 | 3221/3600 | 117 | 5/14 | 12 |
| 2026020342 | DAL–VGK | 45/49 | 34 | 3/8 | 90/90 | 2617/3816 | 143 | 5/14 | 85 |
| 2026020343 | CGY–SJS | 30/61 | 23 | 5/2 | 60/60 | 2584/3600 | 275 | 2/14 | 51 |

509 z 586 buly prošlo do zobrazení (86,9 %). Jde o pokrytí všech zaznamenaných buly, včetně nepodporovaných situací. Každé přijaté buly znamená dvě týmová pozorování. Všech 1 018 zobrazených množin hráčských ID souhlasilo s bruslaři podle TH/TV v první sekundě po vhazování. Ve vzorku bylo 22 různých týmů. DAL–VGK zahrnuje 216 sekund prodloužení. ANA–STL a CGY–SJS obsahují tresty obou týmů ve stejném čase.

**Kontrola hodin.** Intervaly TV a TH byly rozvinuty po sekundách od začátku střídání včetně po konec bez poslední sekundy, po třetinách a s oddělenými brankáři. Součet časů jednotlivých hráčů včetně nulových časů souhlasil s boxscore ve 440/440 položkách. Během 39 816 sekund oboustranná obsazenost neklesla mimo rozsah 3–6 bruslařů na tým. To samo nepotvrzuje sílu na ledě v každé sekundě. Situační kód PBP odpovídal obsazenosti v poslední sekundě před událostí ve 3 243/3 345 případech. První sekunda po buly je zvlášť testovaná hranice, nikoli obecné pravidlo pro ostatní události.

**Kontrola společného času.** Pro sekundy s pěti bruslaři a jedním brankářem na každé straně byly sečteny překryvy tří útočníků či dvou obránců podle pozic boxscore. Porovnání použilo tým a množinu příjmení z nezávisle publikované sekce Lines used, včetně četnosti stejného příjmení. Přesná shoda nastala u 49/151 publikovaných řádků, 101 přiřazených se lišilo, jednomu řádku WSH–TBL chybělo jednoznačné přiřazení. Maximální rozdíl u přiřazených řádků činil 85 sekund. Tento podíl vyjadřuje shodu dvou metod na sekundu, nikoli přesnost celé sestavy. Oba zdroje čerpají z NHL. HockeyWeights neposkytlo nezávislou nominaci PP1/PP2 nebo PK1/PK2.

**EDM–FLA.** Znovu načtené směny dávají 2 931 sekund při obsazenosti 5v5. HockeyWeights vykazuje 48:11 (2 891 s). Starý PR uváděl 2 457 sekund v užším souboru kandidátních intervalů. Nový modul v tomto utkání zobrazuje 50 z 51 buly, z toho 41 při 5v5 a devět při početní výhodě. Všech 100 týmových pozorování odpovídá střídáním. Rozdíl metod u trvání se do rozhraní nepřenáší.

Zdroje pro reprodukci pilotu: [NHL boxscore](https://api-web.nhle.com/v1/gamecenter/2026020335/boxscore), [NHL PBP](https://api-web.nhle.com/v1/gamecenter/2026020335/play-by-play), [zápis PL](https://www.nhl.com/scores/htmlreports/20262027/PL020335.HTM), [střídání EDM](https://www.nhl.com/scores/htmlreports/20262027/TV020335.HTM), [střídání FLA](https://www.nhl.com/scores/htmlreports/20262027/TH020335.HTM), [HockeyWeights](https://hockeyweights.com/game/2026020335/).

## Regrese a rozsah

- Testy výzkumných výpočtů původní větve: 181/181. Testy aplikace a datových kontraktů na integrační větvi: 59/59. Kontrola syntaxe vstupní stránky i lokálních skriptů prošla.
- Chromium: všech 11 reálných sad odpovědí přes detail zápasu na šířkách 390 a 1 366 px, včetně přepnutí projekce, soupisky, 5v5, PP a PK. Dalších pět scénářů kontrolovalo LIVE, FUT, nedostupný boxscore, chybné ID a nedostupný report. Jde o lokální přehrání odpovědí NHL, nikoli nasazení do produkce.
- Browser smoke pokrývá i nejednoznačné vhazování, nesouhlas identity, jiné utkání a prázdnou branku. Kontrola úplnosti projekcí vrací exit 1 pro osm již neúplných týmů. Kontrola pokrytí včetně archivu vrací exit 0.
- Verze rozhraní je určena pro review rozsahu pozorovaných buly. Pro sloučení pod původním zadáním celého modulu zůstává doporučení **NE**. Chybí dostatečná shoda pro publikaci společného času, zdroj pořadí speciálních formací a historicky přiřazené projekce pro srovnání. CORE, produkční databáze a jiné PR nejsou součástí změny.
