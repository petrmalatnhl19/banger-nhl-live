# CORE-ACCURACY-02 – společný snímek T−60

Práce navazuje na [Draft PR #258](https://github.com/petrmalatnhl19/banger-nhl-live/pull/258) od commitu `5427c509045c759de6ff2ff2b64053d99d21ac0e`. Výchozí běhy CORE Accuracy Lab a Frontend smoke byly úspěšné. [Audit etapy 01](AUDIT.md)

## Čas a archivace

1. Pro každý NHL Game ID stanov T−60 jako plánovaný začátek minus přesně 60 minut. Zaznamenej verzi rozpisu, domácí a hosty. Oprava rozpisu s jiným časem zablokuje porovnání s původním snímkem. Po zápase musí odpovídat rozpis i skutečný začátek ověřený sběračem etapy 01.
2. Před T−60 uchovej normalizovaná data, zdroj, čas konce pokrytí `dataThrough`, čas prokazatelného zveřejnění `availableAt`, čas stažení `retrievedAt` a SHA-256 hodnoty `payload`. Pořadí je `dataThrough ≤ availableAt ≤ retrievedAt ≤ observedAt ≤ T−60`. Při převodu archivuj i původní zdrojové podklady u pozorovatele. Nulové absence jsou prázdný seznam z časově doloženého zdroje. Chybějící údaj znamená chybějící položku.
3. Nezávislý pozorovatel před T−60 podepíše otisk celého manifestu včetně jednotlivých časů, zdrojů a otisků. Veřejné klíče ber z předem připnutého konfiguračního souboru. Soubor s daty žádné veřejné klíče nedodává. Podpis ověřuje integritu a výpověď pozorovatele o čase. Samotný podpis neurčuje skutečný čas podpisu ani pravdivost zdrojových údajů. Pro produkční nebo výzkumné tvrzení použij předem dohodnutého nezávislého svědka s uchovaným časovým dokladem. Etapa 02 takového svědka ani živé exportéry nezavádí.
4. Výstup modelu má svůj potvrzený čas výpočtu a stejný otisk manifestu. Výpočet může skončit po T−60, ale před nejdřívějším z plánovaného a skutečného začátku musí být ověřeno, že model použil pouze tento manifest a žádný pozdější zdroj. Je-li možné definovat jedinou předzápasovou predikci pro model a utkání, potvrď ji jednou. Konfliktní záznamy z hodnocení vypadnou.

## Formát a použití

`REFERENCE.json` má pole `snapshots` a `forecasts`. Každá položka je obálka s objektem `manifest` nebo `forecast` a polem `receipt`. Klíče v `TRUST.json` jsou oddělené podle účelu a mapují identifikátor pozorovatele na veřejný PEM Ed25519 v JSON řetězci. Konfiguraci důvěry rozšiř jen o skutečně ověřené klíče a před zahájením validačního období ji ulož společně s verzí protokolu.

| Objekt | Povinná pole |
| --- | --- |
| Manifest | `schema: "banger-core-accuracy-02-v1"`, `gameId` (10 číslic jako řetězec), `away`, `home`, `scheduledAt`, `referenceAt`, `observations` |
| Pozorování v manifestu | `source` (HTTPS nebo URN), `dataThrough`, `availableAt`, `retrievedAt`, `sha256`, `payload` |
| Výstup modelu | `gameId`, `model`, `version`, `referenceAt`, `snapshotSha256`, `computedAt`, `goals: {away, home}`, `goalTarget` (`playedGoals` nebo `regulation`) |
| Potvrzení | `statement: {schema: "banger-accuracy-receipt-v1", purpose, keyId, observedAt, sha256}`, `signature` (standardní base64) |
| Seznam důvěry | `snapshot: {keyId: publicPem}`, `forecast: {keyId: publicPem}` |

Všechny časy mají ISO formát s časovým pásmem. Hodnota `purpose` je `snapshot` nebo `forecast`. Otisk v potvrzení je SHA-256 kanonického JSON celého objektu `manifest` nebo `forecast`. Klíče objektů se řadí rekurzivně, pořadí polí zůstává. Podpis Ed25519 pokrývá kanonický UTF-8 objekt `statement` bez koncového nového řádku. Nástroj `signing-bytes` připraví přesné vstupní bajty pro nezávislého podepisujícího. Podpis vrátí pozorovatel do obálky. Příkaz `freeze` archivuje ověřenou obálku do nového souboru. Přípustný je i neúplný snímek, dashboard uvede chybějící položky a nepoužije jej pro párování.

| Pozorování | Normalizovaný payload |
| --- | --- |
| `schedule` | `{gameId, scheduledAt, away, home}` |
| `teamStats` | Pro obě strany neprázdný objekt s dostupnou podmnožinou `gamesPlayed`, `goalsForPerGame`, `goalsAgainstPerGame`, `xgFor60`, `xgAgainst60`, `powerPlayPct`, `penaltyKillPct`, `recentGoalsForPerGame`, `recentGoalsAgainstPerGame` |
| `lineups` | Pro obě strany neprázdný seznam ID hráčů |
| `goalies` | Pro obě strany `{playerId, status}`, stav `projected` nebo `confirmed` |
| `homeAdvantage` | `{homeAdjustment, awayAdjustment}` |
| `rest` | Pro obě strany `{restHours, backToBack}` |
| `absences` | Pro obě strany seznam ID hráčů |
| `baseline41` a `goalieGsax` | Volitelné pro simulaci. Zmrazené `{goals, version}` CORE 4.1 a pro obě strany `{playerId, gsaxPer100Shots, shotsAgainst}`. GSAx musí patřit stejným hráčům jako `goalies`. |

```sh
node accuracy-lab/snapshot.cjs digest PAYLOAD.json
node accuracy-lab/snapshot.cjs signing-bytes STATEMENT.json STATEMENT.bin
node accuracy-lab/snapshot.cjs freeze ENVELOPE.json TRUST.json SNAPSHOT.json
node accuracy-lab/evaluate.cjs RAW.json REPORT.json REFERENCE.json TRUST.json
```

Bez posledních dvou argumentů evaluátor vykáže pokrytí rozpisu a chybějící snímky. RAW.json dodává stávající sběrač oficiálních výsledků. Výstup otevři přes `accuracy-lab/index.html`. Stažené neveřejné sestavy, důvěru a případné soukromé klíče uchovávej mimo repozitář.

## Párování a dostupnost

Pár používá stejný NHL Game ID, přesný T−60, otisk ověřeného úplného manifestu, stejný cíl gólů a stejnou kategorii predikce. Počítají se unikátní kombinace zápas/model. Pár s rozdílným archivním časem nebo shodným zápasem bez ověřeného manifestu patří pouze do přehledu etapy 01.

| Model | Co lze ověřit lokálně |
| --- | --- |
| CORE 4.0–4.1 | Podpis archivního výstupu ve známé verzi. Součet archivních komponent lze zkontrolovat ve starém auditu. K plnému replay chybí verzovaná tvorba komponent a pro 4.1 přesná brankářská brána. |
| CORE 4.2 | Podpis archivního výstupu ve známé verzi. K replay chybí verzovaný pozdní výpočet a jeho zmrazené vstupy. |
| CORE 4.3 | Simulace citlivosti z existující laboratorní funkce. Plnohodnotná archivní verze a přesná reprodukce jsou nedostupné. |

Sekce reprodukovaných výstupů nyní obsahuje nulu. Pro budoucí replay je potřeba připnout zdrojový commit algoritmu, čistý offline adapter a verze závislostí. Dva běhy z téhož manifestu se musí shodovat v serializovaném výstupu a proti předzápasově potvrzeným kontrolním vzorkům. Součet již vybraných komponent nenahrazuje tento test.

## Předem určené validační období

Zahrň všechny dostupné zápasy základní části NHL s plánovaným začátkem od **1. 12. 2026 00:00 UTC včetně** do **1. 1. 2027 00:00 UTC bez tohoto okamžiku**. Použij souvislý export s úplným pokrytím rozpisu NHL a eviduj každý vyřazený zápas a důvod. Starší data jsou pilotní a mohou sloužit k ladění. Pozdější data patří mimo tento protokol. Před obdobím uzavři verze, důvěru, definice faktorů a metrik. Validační výstupy T−60 a ablace evaluátor uvolní až po konci období. Neupravuj postup podle průběžných skutečných výsledků.

Po konci období lze získat výsledky příkazem níže. Rozsah zápasových dnů přesahuje UTC hranice, aby zahrnul i zápasy s odlišným zápasovým dnem NHL. Evaluátor je zařadí podle plánovaného začátku.

```sh
python3 -B accuracy-lab/collect.py \
  --end 2027-01-01 --cutoff 2027-01-01T00:00:00Z --days 33 --count 1000 \
  --output /tmp/core-validation-raw.json
```

Hlavní metrikou je párový rozdíl MAE na tým pro góly ze hry včetně prodloužení. Sekundární je shoda odvozeného tipu vítěze se skutečným vítězem. Pro každý pár použij stejný průnik pokrytí, vypiš jeho velikost a interval nejistoty odhadni blokovým bootstrapem podle zápasového dne NHL. Je-li vzorek příliš malý pro smysluplný interval, uveď jen popisné hodnoty. Pro tvrzení o nejlepším modelu musí mít všechny posuzované modely společný vzorek.

| Faktor | Jediná změna vůči plné variantě |
| --- | --- |
| Domácí výhoda | Nastavit příspěvek domácí výhody na nulu. Zachovat pořadí týmů. |
| Brankáři | Nastavit brankářský příspěvek na nulu. Zachovat identitu, stav i ostatní vstupy. Laboratorní simulace používá GSAx koeficienty 0,02 a 0 nad stejným snímkem. |
| Odpočinek a únava | Nastavit příspěvek odpočinku a únavy na nulu. Zachovat kalendář i historii utkání. |
| Absence | Nastavit příspěvek absencí na nulu. Zachovat sestavy, ID hráčů a ostatní vstupy. |

Varianty počítej stejným modelem, cílem, zdrojovým manifestem a postupem. Vedle přírůstku MAE vykazuj rozdíl v pokrytí a zda jsou odhadnuté změny stabilní napříč zápasovými dny. Experiment s 4.3 zatím ukazuje jen rozdíl predikovaných gólů při vypnutí GSAx, bez společného produkčního výsledku.

## Výsledek etapy 02 a navazující pilot

Na dosavadních 100 skutečných výsledcích je **0 ověřených úplných snímků T−60, 0 srovnatelných skutečných predikcí a 0 párových zápasů**. Nejlepší model z těchto dat určit nelze. Podepsané testovací obálky ověřují funkčnost párování a vylučování pozdních údajů. Místní zkušební výpočet 4.3 zůstává označen jako simulace.

Pro CORE-ACCURACY-03 připrav konkrétní zdrojové exportéry a ověřené časy zveřejnění. Na několika budoucích utkáních změř jejich pokrytí a dokonči správu důvěry s nezávislým pozorovatelem. Dolož čistý adapter alespoň dvou modelů na stejném vstupu, zaznamenej první skutečný referenční pár a teprve po uzavření validačního období spusť hodnocení. Produkční tok zůstává mimo tento pilot.
