# CORE43-CAL-12 dlouhodobé měření

## Audit dostupných dat k 15. listopadu 2026

| Ukazatel | Počet |
| --- | ---: |
| Dohrané zápasy s dostupnými údaji CORE 4.2 před kontrolou párování | 49 |
| Archivované předzápasové zápasy CORE 4.3 | 1 |
| Předzápasové varianty CORE 4.3 s koeficienty `0` / `0.005` / `0.02` / `0.03` | 0 / 0 / 1 / 0 |
| Starší revize `core43_shadow` typu `shadow` | 0 |
| Historické zápasy s úplnou sadou pro společné vyhodnocení | 0 |
| Historické zápasy s archivovanou pravděpodobností výhry pro všechny řady | 0 |

Výsledky pocházejí z dotazů pouze pro čtení nad projektem `app-development`. Jediný zápis pro zápas `2026020293` vytvořil ruční pilot na větvi `main` 11. listopadu ve 22:14 českého času. Log potvrzuje `inserted: true` a archiv obsahuje pouze variantu `0.02`. Předchozí běh hlásil `dry_run_ready`, ještě starší neměl způsobilý zápas s dostupným základem. Úspěšný stav workflow tedy sám o sobě počet uložených predikcí nezvyšuje. Plánovaný CAL-04 má živý job explicitně vypnutý. [Zápis pilotu](https://github.com/petrmalatnhl19/banger-nhl-live/actions/runs/43101255144) · [Předchozí dry-run](https://github.com/petrmalatnhl19/banger-nhl-live/actions/runs/43100585512) · [Běh bez vstupů](https://github.com/petrmalatnhl19/banger-nhl-live/actions/runs/43064419487)

CORE 4.2 a všechny čtyři varianty experimentální CORE 4.3 v prověřené archivaci poskytují očekávané góly hostů a domácích. Přehled v aplikaci obsahuje i samostatný experimentální Poissonův model na 60 minut s možností remízy. Ten nemá stejný cíl jako výhra včetně prodloužení a nájezdů a nedoplňuje žádnou chybějící historickou pravděpodobnost pro CORE 4.2 nebo 4.3. Brier a log loss proto zůstávají bez historického odhadu. [Výsledky CAL-11](core43-cal11-offline-accuracy.md)

## Od exportu k důkazu předzápasové predikce

1. Z ověřeného exportu CAL-07 vypočítejte celý balíček. Obsahuje model CORE 4.2, všechny čtyři koeficienty CORE 4.3, časy, identitu zápasu a otisky původního exportu i jednotlivých variant. Chybějící vstupy zastaví přípravu. Simulované exporty mají vlastní označení a konfiguraci.
2. Předzápasový balíček a originální podepsaný export dostane nezávislá služba s vlastním klíčem a hodinami. Přepočte předpovědi ze zdrojového exportu, porovná jejich přesný otisk a Ed25519 podepíše identitu služby, SHA-256 celého balíčku a skutečný čas přijetí. Čas musí být před plánovaným začátkem, v rozmezí od zmrazení do pěti minut po něm. Kontrolující strana používá veřejné klíče exportéra a časové služby z nezávislé konfigurace. Klíče musí být různé.
3. Uložte celý balíček, potvrzení a původní podepsaný export v neveřejném úložišti s neměnnými objekty. Index vygenerujte podle původu, ID zápasu a naplánovaného času. Přijetí stejného objektu je idempotentní. Odlišné potvrzené záznamy pro stejný klíč vyžadují vyřešení konfliktu. Při přesunu zápasu se starý objekt zachová pro audit a do výsledků se zařadí jen záznam s potvrzeným časem a shodnými týmy. Pro aktuální index lze navázat na monotónní hlavičku a transakční zápis CAL-09. Zjednodušený SQLite záznam CAL-08 sám neuchovává celý balíček a potvrzení.

Platný podpis dosvědčuje, že časová služba měla přesný balíček k dispozici v uvedeném okamžiku. Důkaz závisí na nezávislé správě klíče, ověřených hodinách a zákazu zpětného datování u služby. Pro produkční časovou službu lze samostatně posoudit také standard RFC 3161. Ten prototyp neimplementuje. [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html)

## Párování a přehled připravenosti

Po dohrání zápasu samostatně importujte uložený konečný NHL boxscore a skutečný začátek z oficiálního zápisu. Evidenci průběžně porovnávejte s předem zvoleným rozsahem zápasů. Historická řada vyžaduje shodné ID, týmy a plánovaný čas, konečný stav a potvrzení před skutečným začátkem. Pokud zápis poskytuje čas jen na minutu, použijte začátek této minuty jako konzervativní mez. Stav po prodloužení nebo nájezdech patří mezi konečné výsledky. Predikční soubory se po dohrání nemění. Ověření používá stejnou normalizaci NHL jako CAL-11. [Příklad oficiálního zápisu NHL](https://www.nhl.com/scores/htmlreports/20262027/GS020293.HTM) · [Formát výsledků CAL-11](core43-cal11-offline-accuracy.md#jak-vyhodnotit-vlastní-archiv-offline)

```bash
node scripts/core43_cal12_archive.cjs schedule.json archives.json outcomes.json trust.json
```

`schedule.json` je pole zápasů s `gameId`, `kickoffAt`, `awayTeam` a `homeTeam`. `archives.json` je pole dvojic `capture` a `receipt` vrácených z funkcí `prepareCapture` a `attestCapture`. `outcomes.json` používá formát CAL-11. `trust.json` obsahuje `origin`, `witnessId`, `witnessPublicKey` a objekt `exportTrust` s `source`, `keyId` a `publicKey`. Klíče jsou PEM veřejné klíče.

Report rozlišuje očekávané zápasy, získané záznamy, ověřené varianty, přesné duplicity, chybějící nebo neúplnou predikci, chybějící či vadné potvrzení, kolize a chybějící nebo vadný výsledek. Počty zápasů připravených na hodnocení vítěze a pravděpodobnosti jsou samostatné. Před importem do CAL-11 ověřte časové potvrzení a předejte vrácený doklad pouze spolu s přesnou predikcí, ke které patří.

**Funkční offline** jsou čtyři varianty v jednom balíčku, ověření Ed25519 dvěma rolemi, detekce pozdního nebo upraveného balíčku a přehled připravenosti. CI pracuje výhradně s testovacími klíči a syntetickými zápasy. **Živému sběru** nadále brání schválení skutečného zdroje exportu pouze pro čtení, neveřejné doručení, nezávislá časová služba, trvalý koordinátor a kontrolní bod pro obnovu. Spuštění je podmíněno výslovným schválením.
