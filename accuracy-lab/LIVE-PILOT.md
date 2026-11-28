# CORE-ACCURACY-06 – ruční předzápasový pilot

Navazuje na [Draft PR #258](https://github.com/petrmalatnhl19/banger-nhl-live/pull/258) od commitu `cd6b74a575e98b3a6cf2102d7c9f410182843b80`. Obě výchozí kontroly prošly. Pilot používá izolované výpočty v26 z etapy 05 a stávající kontroly NHL preview, soupisek a časového okna. [Přesný offline výpočet](V26-OFFLINE.md) · [Formát referenčního manifestu](REFERENCE.md)

## Vybraný zápas

| Údaj | Hodnota |
| --- | --- |
| NHL Game ID | `2026020342` |
| Hosté / domácí | Dallas Stars / Vegas Golden Knights |
| NHL zápasový den | 17. listopadu 2026 |
| Plánovaný začátek | 18. listopadu 03:00 UTC · 04:00 SEČ |
| T−75 | 18. listopadu 01:45 UTC · 02:45 SEČ |
| T−60 | 18. listopadu 02:00 UTC · 03:00 SEČ |

Rozpis ověřen z NHL Score 16. listopadu. Při ručním spuštění se načte znovu a sváže s archivním rozpisem a Game ID. [NHL Score](https://api-web.nhle.com/v1/score/2026-11-17) · [Oficiální rozpis Dallasu](https://www.nhl.com/stars/news/dallas-stars-announce-2026-27-regular-season-schedule-071626)

## Vstupy a důkazy

| Oblast | Zdroj a podmínky |
| --- | --- |
| Rozpis, týmové statistiky, únava a odpočinek | NHL Score, datovaná NHL Standings a sezonní rozpisy obou týmů. Odpočinek je rozestup plánovaných začátků. Předchozí relevantní zápas musí být dohraný. |
| Forma, xG4, speciální týmy a brankářská komponenta | Jediný odpovídající `pending` řádek ve veřejném read-only `nhl_prediction_archive`. Čísla a původní faktory se berou z `advanced_*`, `xg4_*`, `special33_*` a `goalie32_*`. Ověřují se přesné identifikátory v26, čas každého výpočtu, role týmů, UTC datum a shoda s `nhl_core43_public_schedule_evidence`. |
| Brankáři a faktory CORE 4.1 | Oba odpovídající brankáři z veřejného zrcadla RotoWire. Původní `goalie32_factors` přichází se stejnou odpovědí jako komponenty. Příznak `goalie_data_missing` a vzorky střel se nepřepisují. Výběr brankářské složky v 4.1 se řídí existující bránou v26. |
| Sestavy a absence | Přímé NHL preview a sezonní soupisky obou týmů. Vyžadují se doložené skupiny podle etapy 04, jednoznačná NHL ID, odpovídající Game ID a načtení před hranicí. Doplňkové identity bez časového dokladu se do pilotu nezařazují. |
| Domácí výhoda | Statická konfigurace auditované v26. Násobky 0,985 hosté a 1,015 domácí odpovídají odchylkám −0,015 a +0,015. Konfigurace je ve výstupu označena jako připnutý zdroj a k archivovaným hodnotám se znovu nepřičítá. |

Původní odpovědi tohoto sběru se uchovávají jako bajty se SHA-256, URL a časy požadavku a dokončení čtení. Identifikátor verze komponenty, původní faktory a čas výpočtu zůstávají v archivní odpovědi. Čas publikace NHL článku se zobrazuje zvlášť a lze použít jen jeho staženou verzi s doloženým časem změny. `predicted_at` uvnitř archivního řádku je čas výpočtu. Čas zveřejnění surových podkladů nebo prvního zpřístupnění archivního řádku z něj nelze odvodit. Pilot opakuje přesný ensemble ze zmrazených mezivýsledků. Původní síťové odpovědi, které tehdy použil produkční proces pro tvorbu těchto mezivýsledků, jeho veřejný archiv neposkytuje.

Sběr i podpis musí doběhnout nejpozději v T−60. Pro povinný vstup se kontroluje začátek požadavku, konec čtení, dostupnost, integrita a vazba na utkání. Změněný plán, pozdní vstup nebo chybějící komponenta zanechají diagnostický záznam bez výsledku. Oba modely pracují s jedním vstupním objektem se společným SHA-256. Výsledky se zobrazí až po místním zapečetění a opětovném deterministickém ověření archivu.

## Ruční spuštění

Ve 02:45–03:00 SEČ dne 18. listopadu spusť následující příkazy v kořeni repozitáře. Předem připrav prázdné cílové cesty a vlastní podpisový klíč Ed25519 mimo repo. Doporučený start je na začátku okna, aby zbyl čas na zdrojové odpovědi i místní podpis.

```sh
node accuracy-lab/pilot.cjs capture 2026-11-17 2026020342 LIVE.json
node accuracy-lab/pilot.cjs status LIVE.json LIVE-STATUS.json
node accuracy-lab/pilot.cjs seal LIVE.json /bezpecna/cesta/operator-ed25519.pem SEALED.json
node accuracy-lab/pilot.cjs status SEALED.json SEALED-STATUS.json
node accuracy-lab/pilot.cjs export-time SEALED.json RFC3161-EXPORT.json
node accuracy-lab/external-time.cjs extract-tsq RFC3161-EXPORT.json SNAPSHOT.tsq
node accuracy-lab/external-time.cjs extract-envelope RFC3161-EXPORT.json SNAPSHOT.bin
```

Pro diagnostiku mimo okno použij `node accuracy-lab/pilot.cjs probe 2026-11-17 2026020342 PROBE.json`, následovanou příkazem `status PROBE.json PROBE-STATUS.json`. Diagnostiku z tohoto příkazu nelze zapečetit jako živý snímek.

Do [dashboardu](index.html) načti libovolný z výstupů STATUS. Export pro časovou autoritu je lokální. Požadavek RFC 3161 míří na kanonické podepsané bajty a podepsaný manifest nese SHA-256 celého archivu včetně původních odpovědí, vstupu, výsledků a důvodů odmítnutí. Soubory vznikají atomicky na nové cestě. Ověřovač znovu vypočítá vstupy, výsledky i svázané otisky. Lokální soubor lze na úrovni OS nahradit, proto pro nezávislé prokázání pozdější nezměněnosti uchovej původní podepsaný otisk mimo úložiště operátora. Příkazy žádnou časovou autoritu nekontaktují.

## Výsledek a další krok

Dne 16. listopadu proběhl skutečný diagnostický odběr **před oknem**. Veřejný archiv dal všechny čtyři verzované komponenty, původní brankářské faktory a shodný rozpis. Preview sestav a absencí ještě nebylo dostupné. RotoWire zrcadlo neposkytlo odpovídající dvojici brankářů. Domácí výhoda je připnutá a do předčasného snímku se nezařadila jako pozorování z okna.

- Živý sběr v T−60 **neproběhl**. Výsledek obsahuje **0 úplných nezávisle ověřených snímků, 0 interně vypočtených párů a 0 platných párových predikcí**.
- CORE 4.0 a 4.1 jsou na tomto zápase bez vypočtené hodnoty. Externí časové potvrzení chybí.
- **CORE-ACCURACY-07** provést ruční sběr v ověřeném okně, ověřit chybějící preview a brankáře, zapečetit skutečný pár a přijmout externí odpověď. Při ověřování odpovědi navázat na otisk, nonce, předem připnuté důvěryhodné certifikáty a potvrzený čas s nejistotou před T−60.
