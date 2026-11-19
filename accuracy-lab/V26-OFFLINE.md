# CORE-ACCURACY-05 – přesný offline ensemble v26

Etapa navazuje na [Draft PR #258](https://github.com/petrmalatnhl19/banger-nhl-live/pull/258) od commitu `8a9a91f76982edd2985ee8376c08e269c0f43791`. Obě jeho kontroly prošly. Změny jsou omezené na laboratoř a její testy. [Audit etapy 04](REPLAY-AUDIT.md)

## Co je přesně reprodukovatelné

Read-only načtení zdroje potvrdilo `nhl-prediction-collect`, ACTIVE **v26**, `index.ts`, otisk balíku `aad6123716126e4ab7f7934daec6aa4fd9dae446cd08038ac2d5174d3c2bd42b`. Offline modul izoluje čistý ensemble z řádků 269–282 a 297–311. Síťové volání, hodiny produkčního procesu, stav archivu, databázové zápisy a sběr vstupů zůstávají mimo modul. Výpočet původních komponent xG4, 3.2, 3.3 a 3.1 z prvotních NHL odpovědí tento kontrakt nepokrývá.

- **CORE 4.0** vyřazuje neplatné složky podle v26. Vyžaduje aspoň dvě včetně xG4, pro každou přijatou složku dvě čísla alespoň 0,4 a archivní čas před plánovaným startem. Váhy jsou postupně 0,40, 0,25, 0,20 a 0,15. Sečtou se v pořadí produkčního zdroje, skóre se vypočítá s normalizací a omezí na 0,4–6.
- **CORE 4.1** používá stejné pořadí, váhy i meze. Brankářská složka navíc vyžaduje doslovné `goalie_data_missing === false` a po převodu na číslo aspoň 30 střel u každého brankáře. Výstup uvádí produkční důvod vyřazení. Chybějící doklad o hodnotě `goalie32_factors` nedovolí přesnou 4.1. Výslovně doložená hodnota `null` znamená známé nesplnění brány.
- Vstupní obálka T−60 navíc vyžaduje časovou dostupnost každé hodnoty nejpozději v referenčním okamžiku. Tento filtr brání úniku pozdějších dat a zachovává produkční pravidla uvnitř výpočetního jádra. Oba modely dostanou stejné vstupní bajty identifikované jedním SHA-256.

## Tři oddělené výstupy

| Režim | Co dokládá | Počítá se jako skutečný pár |
| --- | --- | --- |
| `exact_ensemble` | Přesná reprodukce části v26 z úplných zmrazených vstupů ensemble včetně dokladu o hodnotě brankářských faktorů pro 4.1. Časové údaje vstupního souboru čekají na nezávislé doložení. | Ne |
| `archived_intermediates` | Zpětný součet skutečně uložených přijatých vstupů a porovnání s archivním skóre. Neodhaduje nepřítomné kandidáty ani zpětně neodvozuje stav brány 4.1. | Ne |
| `simulation` | Stejné jádro nad výslovně testovacími či syntetickými údaji. | Ne |

V pilotním archivu souhlasí **66/66 CORE 4.0 a 66/66 CORE 4.1**, celkem **132** výstupů do tolerance 1e−9 gólu. Největší rozdíl je přibližně 4,88e−15 gólu a vyplývá z reprezentace desetinných čísel. Izolované výrazy z načteného v26 navíc prošly 600 porovnáními s offline modulem, včetně bran, důvodů vyřazení, mezí a normalizovaných vah. Experimentální testy nejsou historické predikce. Dosavadní 100zápasový vzorek neobsahuje úplnou společnou T−60 obálku s externím dokladem. Počet skutečných přesných přepočtů z takové obálky je **0**, počet úplných ověřených snímků **0**, počet platných párů **0**.

### Spuštění a vstupní kontrakt

```sh
node accuracy-lab/v26-replay.cjs replay FROZEN-COMPONENTS.json REPLAY.json
node accuracy-lab/v26-replay.cjs archive-check RAW.json ARCHIVE-CHECK.json
```

`RAW.json` je výstup původního [sběrače etapy 01](README.md). `FROZEN-COMPONENTS.json` má `schema: "banger-core-v26-input-v1"`, `mode: "exact"` nebo `"simulation"`, `gameId` jako 10místný řetězec, `scheduledAt`, `referenceAt` a `components` s klíči `xg4`, `goalie32`, `special33` a `form31`. U každé složky uveď obě hodnoty `away`, `home`, `predictedAt`, `availableAt` a `source` (HTTPS nebo URN). Doložená absence celé složky má obě hodnoty i `predictedAt` rovné `null` a přitom doložené `availableAt` a `source`. Objekt `goalie32Factors` nese `availableAt`, `source` a původní `payload`. Výstupy jsou JSON pro existující dashboard. Tabulka uvádí jednotlivé odchylky a chybějící vstupy.

## Doplňkové zdroje absencí

```sh
node accuracy-lab/absence-evidence.cjs export PLAYERS.json ABSENCE-SOURCES.json EVIDENCE.json
node accuracy-lab/absence-evidence.cjs status EVIDENCE.json ABSENCE-STATUS.json
```

`PLAYERS.json` je výstup přímého exportu [etapy 04](REPLAY-AUDIT.md). `ABSENCE-SOURCES.json` obsahuje 1–10 objektů `{team, name, transaction}`. `transaction` je kanonické URL oficiální zprávy daného klubu na NHL.com. Sběrač vyhledá jednoznačné celé jméno v oficiálním vyhledávání NHL a ověří ID i celé jméno v `/v1/player/{id}/landing`. Klubová zpráva dokládá příslušný přestup nebo přidělení v čase uvedeným vydavatelem. Pro každý zdroj se uchová URL, stažení, případný čas publikace a úpravy i SHA-256. Metadata vyhledávání a profilu nedokládají jejich původní čas zveřejnění. Doplňky jsou diagnostické, protože jednotlivá klubová zpráva sama nedokládá stav všech změn k T−60.

U Florida–Dallas se dohledal **Jack Devine (8483433)** i **Rémi Poirier (8482465)**. Devine je uvedený v preview, zároveň existuje zpráva o jeho zapůjčení do AHL. U Poiriera klub dokládá převzetí z waiver listiny. Doplňkové odpovědi byly staženy po referenčním okamžiku. Záznamy proto nezměnily dostupnost absencí v historickém snímku. [Florida](https://www.nhl.com/panthers/news/on-the-right-track-panthers-loan-forward-jack-devine-to-ahl) · [Dallas](https://www.nhl.com/stars/news/dallas-stars-claim-goaltender-remi-poirier-off-of-waivers-from-washington-110926)

## Podepsaný export k externímu potvrzení

```sh
node accuracy-lab/external-time.cjs prepare MANIFEST.json /bezpecna/cesta/operator-ed25519.pem EXPORT.json
node accuracy-lab/external-time.cjs verify EXPORT.json
node accuracy-lab/external-time.cjs status EXPORT.json TIME-STATUS.json
node accuracy-lab/external-time.cjs extract-envelope EXPORT.json SNAPSHOT.bin
node accuracy-lab/external-time.cjs extract-tsq EXPORT.json SNAPSHOT.tsq
```

Příprava běží před T−60, používá existující manifest a klíč provozovatele mimo repozitář. Kontroluje místní podpis Ed25519, otisk manifestu a shodu SHA-256 požadavku RFC 3161 s přesnými kanonickými podepsanými bajty. Žádost má vlastní nonce a žádá certifikát časové autority. Operátor může předat `SNAPSHOT.bin` a otisk nezávislému svědkovi nebo přesně svázaný `SNAPSHOT.tsq` časové autoritě. Tato etapa žádost nikam neodesílá, nevydává odpověď autority a nezařazuje export mezi platné páry. `TIME-STATUS.json` zobrazuje stav „neověřeno“ a skutečné chybějící vstupy. Místní podpis dokládá integritu, čas externího potvrzení zůstává otevřený.

## CORE-ACCURACY-06

Připnout nezávislého ověřovatele a jeho veřejnou důvěru. Doplnit příjem skutečného potvrzení, ověřit řetězec a případnou autoritu RFC 3161, SHA-256, nonce, deklarovanou přesnost a čas před T−60. Při prvním živém pokusu zmrazit čtyři vstupní komponenty a původní `goalie32_factors` se zdrojovými časy. Archiv a kontrolní výpočty teprve poté spojit do prvního platného páru. Zachovat předem určené validační období z etapy 02.
