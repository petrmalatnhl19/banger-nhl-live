# CORE-ACCURACY-04 – reprodukovatelnost a evidence hráčů

Práce pokračuje v [Draft PR #258](https://github.com/petrmalatnhl19/banger-nhl-live/pull/258) od commitu `ecee85d554e4632d462b4402d7c056c9b96f9137`. Obě výchozí kontroly prošly. Audit proběhl 16. listopadu 2026. Produkční výpočet nebyl spouštěn ani upravován. [Srovnání etapy 01](AUDIT.md) · [Časový protokol](REFERENCE.md) · [Ruční sběr](PREGAME.md)

## Skutečný zdroj a dostupný replay

Přímé read-only načtení správy funkcí potvrdilo `nhl-prediction-collect` jako ACTIVE v26, vstupní soubor `index.ts`, otisk balíku `aad6123716126e4ab7f7934daec6aa4fd9dae446cd08038ac2d5174d3c2bd42b`. Otisk odpovídá dřívějšímu auditu. Jde o verzi nasazenou v den kontroly. Historický archiv ukládá identifikátor logiky a predikované hodnoty, ale u všech predikcí nepřipojuje verzi nasazeného balíku ani bajty původních zdrojů. [Původní audit implementace](../PREDICTION_INPUT_AUDIT_2026-11-07.md) · [Evidence v26](../docs/core43-deployed-collector-audit-2026-11-10.md)

| Model a verze | Zdroj a přesný výpočet | Co lze zopakovat a co chybí |
| --- | --- | --- |
| CORE 4.0 `banger-core-v4.0-pregame-ensemble` | `index.ts` v26, ř. 260–287. Používá dříve zmrazené xG4 (40 %), brankáře 3.2 (25 %), speciální týmy 3.3 (20 %) a formu 3.1 (15 %). Každá přijatá komponenta má obě hodnoty alespoň 0,4 a čas před začátkem. Nutné jsou alespoň dvě včetně xG4. Po normalizaci vah omezuje skóre na 0,4–6. | Výsledný součet z uložených komponent je deterministický. Pro výpočet z jednotného T−60 chybí původní zdrojové snímky standings, formy a zápasových statistik, verze MoneyPuck CSV pro xG4 a zmrazený vzorek pro brankářskou složku. |
| CORE 4.1 `banger-core-v4.1-quality-gated` | `index.ts` v26, ř. 289–316. Stejné nominální váhy a meze. Brankářská složka vyžaduje explicitně `goalie_data_missing === false` a alespoň 30 střel u každého brankáře. | Součet přijatých vstupů je deterministický. K zopakování výběru z totožného vstupu jsou potřeba původní kandidáti, `goalie32_factors` a časově doložené vzorky střel obou brankářů. |
| CORE 4.2 `banger-core-v4.2-late-goalie` | `index.ts` v26, ř. 328–365. Okno do 12 hodin, RotoWire snapshot mladší než 6 hodin, právě jeden zápasový záznam za stranu, shoda s NHL soupiskou a alespoň 30 střel za každého brankáře. Zohledňuje 75 % normalizované 4.1 bez brankářů a 25 % týmové formy upravené brankářem soupeře. Vzorek používá posledních nejvýše 20 dohraných zápasů týmu, prior 120 střel a omezení úpravy 0,96–1,04. | Archiv obsahuje součty střel a zákroků potřebné pro opakování aritmetiky. Pro plný replay chybí původní RotoWire snapshot pro zápas, tehdejší soupisky, přesně vybrané odpovědi NHL boxscore a zmrazené mezivýsledky 4.1 a formy před stejnou hranicí. |
| CORE 4.3 experiment | `core43_gsax_sensitivity_v0` v [scripts/core43_gsax_sensitivity.cjs](../scripts/core43_gsax_sensitivity.cjs), commit poslední změny `1d656d6094516d8de731b81a55c098c452edef56`, SHA-256 `d2092a795031f145c6d9793e1a0e6638c7b153f25f199c740cb41ac0abf7414d`. Používá zmrazenou 4.1 a GSAx na 100 střel obou brankářů, nejméně 30 střel na každého, default 0,02 a omezení změny ±0,2 gólu. CAL-03 na #230 používá odlišný experiment nad 4.2 se čtyřmi koeficienty. | Funkci citlivosti lze offline spustit deterministicky nad shodnými daty. Chybí živý ověřený snapshot s baseline, jmennými ID a původní GSAx evidencí. Výsledky zůstávají simulacemi. [CAL-03 na připnutém pilotním commitu](https://github.com/petrmalatnhl19/banger-nhl-live/blob/58ebed13f2bf5ae932729bf5a46eb05e54387051/scripts/core43_cal03_capture_plan.cjs) |

Kontrolní přepočet aritmetiky z historicky uložených mezivýsledků souhlasil do tolerance 1e−9 pro 66/66 výstupů 4.0, 66/66 výstupů 4.1 a 54/54 výstupů 4.2. U 4.2 byla týmová forma převzata ze složky `form31` archivované 4.1. Tato kontrola neověřuje získání mezivýsledků ani původní rozhodnutí o přijetí podkladů. Pro úplný offline běh dvou skutečných modelů nemáme společný ověřený T−60 manifest. Aritmetické přepočty se v dashboardu nezapočítávají do skutečných párů.

## Nové zdroje a kontrola úplnosti

- Přímo publikované jednotlivé **NHL Game Preview**. Odkaz svazuje oficiální NHL Score, oba týmy a zápasový den. Export vyžaduje kanonické URL, odpovídající nadpis a vydavatelská pole `datePublished` a `dateModified`. Každý řádek nese Game ID, stav, zdroj, časy a otisk bajtů článku. Změna článku po hranici vyloučí tuto konkrétní verzi, i když původní publikace byla dřívější.
- Oficiální NHL `/v1/roster/{team}/{season}` poskytuje hráčská NHL ID pro oba týmy. Každá identita musí být jednoznačná v sestavě příslušného týmu. Otisk a čas stažení soupisky jsou evidovány zvlášť. Stažení soupisky neprokazuje dobu prvního zveřejnění ani historické členství k jinému okamžiku. Historický odběr slouží pouze diagnostice.
- Úplná sestava vyžaduje u obou týmů čtyři trojice útočníků a tři dvojice obránců s 18 jednoznačnými ID. Brankáře pokrývá zvláštní povinný vstup. Absence vyžadují explicitní seznamy `Scratched` a `Injured` u obou týmů včetně výslovného `None` pro prázdný seznam. Chybějící sekce, hráč bez ID, duplicita nebo rozporné zařazení brání úplnosti. Potvrzený stav se použije pouze při explicitním potvrzení sestavy vydavatelem. Projekce zůstává očekávaná.
- Starší podpisy protokolu ACCURACY-02/03 jsou v novém reportu čitelné jako diagnostika. Jejich starší kritéria neověřují úplnost nového důkazu sestav a absencí. Nový testovací export má oddělené schéma a nikdy neprojde běžným ověřovačem referenčních párů.

### Diagnostický odběr FLA–DAL

Skutečný export utkání `2026020327` našel 36 očekávaných hráčů sestav s NHL ID a 11 absencí s NHL ID. Dvě absence bez jednoznačné shody v sezonních soupiskách znamenaly neúplné seznamy. Článek uváděl zveřejnění 15. listopadu ve 23:34 SEČ a poslední změnu ve 23:34:54 SEČ. Odběr proběhl 16. listopadu až po utkání. Výsledek tvoří **0 úplných ověřených snímků T−60, 1 neúplný diagnostický záznam a 0 platných párů**. Souborné vyhodnocení předchozích 100 zápasů také nedává žádný nový ověřený snímek ani pár. [NHL preview](https://www.nhl.com/news/florida-panthers-dallas-stars-game-preview-november-15-2026)

## Test časového dokladu a integrita

```sh
node accuracy-lab/players.cjs export 2026-11-15 2026020327 PLAYERS-PROBE.json
node accuracy-lab/players.cjs status PLAYERS-PROBE.json STATUS.json
node accuracy-lab/players.cjs export NHL_DATE GAME_ID PLAYERS.json CAPTURE.json
node accuracy-lab/test-witness.cjs issue-test REQUEST.json RECEIPT.json
node accuracy-lab/test-witness.cjs verify-test REQUEST.json RECEIPT.json TEST-STATUS.json
```

`CAPTURE.json` vzniká v okně T−75 až T−60 podle etapy 03. Příkaz s jeho názvem opět využije stejné původní NHL Score a během okna získá preview a obě soupisky. Testový požadavek `banger-accuracy-test-request-v1` má pole `schema`, `capture`, `review` a `players` s obsahem souborů etapy 03 a nového exportu. Volitelné `homeAdvantage` je pozorování stejného formátu jako v manifestu etapy 02. Bez doložené hodnoty zůstane chybějícím vstupem.

Ověřovač znovu odvodí oba vstupy z původních bajtů, porovná NHL Game ID, čas a otisky, sestaví manifest a ověří Ed25519 nad odděleným testovacím formátem. `TEST-STATUS.json` se zobrazuje v existujícím dashboardu. Lokálně vygenerovaný testovací klíč a lokální čas slouží k testu přenosu a integrity. Výstup explicitně uvádí `independentlyVerified: false` a `eligibleForPairing: false`. Externí časová autorita nebo nezávislý pozorovatel v této etapě použit nebyl. Sady s testovacími klíči pokrývají úplný i neúplný stav, záměnu ID, pozdní změnu vydavatele, porušený podpis a přenos do staršího protokolu.

## CORE-ACCURACY-05

1. Dohodnout nezávislou časovou instituci nebo svědka a oddělenou správu důvěry. Připnout pravidla časové důvěry před živým sběrem. U prvního pokusu uchovat nezměnitelné původní bajty všech zdrojů i nezávislý doklad vzniku.
2. Zpřesnit identitu absencí, které sezónní soupiska nepokrývá, pomocí oficiálního časově doloženého zdroje přidělení hráče k týmu. Připnout modelovou konfiguraci domácí výhody a explicitní stav dostupnosti.
3. Připravit samostatný offline balík schválené logiky v26 pro alespoň CORE 4.0 a 4.1. Explicitně předat zmrazené společné vstupy a porovnat s referenčními hodnotami včetně bran a náhradních cest. Teprve potom vykázat skutečný referenční pár.
