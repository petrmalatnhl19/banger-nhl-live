# CORE43-CAL-13 bezpečná infrastruktura sběru

Výchozí Draft PR #230 na commitu `523b84a8a35ff30b3d4989ed4b53b99f7b6f5c3c` měl všech pět běhů úspěšných. Živá větev CAL-04 zůstává vypnutá.

## Audit CAL-07 až CAL-12

| Část | Funkční základ | Hranice ověření |
| --- | --- | --- |
| CAL-07 | Ed25519, původ, čas a přesný datový rozsah exportu. | Soubor se předával lokálně. Podpis sám nedokládá nezávislý čas ani pravdivost údajů původce. |
| CAL-08 | Atomické uložení čtyř variant v SQLite. | Procesy používají jeden soubor na jednom hostiteli. Uložený výběr polí nepřenáší celý původní export. |
| CAL-09 | Podepsaný SQLite snímek, ověření aktuální verze a podmíněný zápis hlavičky. | Aktuálnost závisí na důvěryhodné hlavičce. Obnovení celé autority ze starší zálohy vyžaduje nezávislý kontrolní bod. |
| CAL-10 | Celý řetězec ověřený na třech simulovaných zápasech s 12 variantami. | Oddělené procesy a adresáře byly na jednom stroji. |
| CAL-11 | Shodné historické vzorky, počty a metriky s doloženým původem. | Žádná úplná historická sada. Simulované výsledky neurčují historickou přesnost. |
| CAL-12 | Časové potvrzení celého balíčku samostatným klíčem, párování se skutečným začátkem a přehled pokrytí. | Nebyla provozována nezávislá časová služba ani správa rotace klíčů. |

## Co ověřuje prototyp CAL-13

- Kompletní balíček přenáší původní proud bajtů CAL-07, jeho podpis, všechny čtyři varianty a časové potvrzení CAL-12. Příjemce stahuje objekt adresovaný SHA-256 přes HTTPS s ověřením certifikátu, omezenou velikostí a časovým limitem. Odmítá přesměrování a neshodný obsah. Čtecí identita může volat pouze GET objektu. Oddělená identita může balíček předat koordinátoru a nemá právo zapisovat do úložiště.
- Koordinátor používá SQLite v soukromém adresáři. V jedné transakci ověří aktuální registr, oba podpisy a přesnou reprodukci výstupu ze zdrojového exportu. Uloží celý balíček a verzi registru. Konkrétní evidence je svázaná se zdrojem a původem přes podepsanou politiku. Stejné ID a kanonický začátek zápasu se uloží jednou. Identické opakování vrátí původní potvrzení. Odlišný balíček pro stejný klíč hlásí konflikt a původní záznam zůstane k dispozici. Po chybě před potvrzením se transakce vrátí zpět. Po ztrátě odpovědi lze bezpečně zopakovat požadavek.
- Kořenový veřejný klíč je mimo přijímaná data. Podepsaný registr odděluje exportéra a časového svědka podle ID, role, zdroje, původu a intervalu platnosti. Rotace přidá nové ID a může zkrátit interval starého klíče. Starší verze, odlišný obsah stejné verze, změna klíče pod stejným ID, prodloužení starého intervalu a odvolání revokace se odmítnou. Při kompromitaci zneplatnění blokuje i dříve přijaté balíčky podepsané dotčeným klíčem. Jejich bajty zůstávají k incidentnímu auditu. Čtení pro vyhodnocení znovu ověří aktuální politiku.
- Dva samostatné procesy používají skutečné TLS se syntetickými klíči a dvěma různými identitami. Koordinátor přežije opětovné otevření disku a odmítne poškozený záznam. Testy ověřují chybu potvrzení i přerušenou odpověď. Procesy, úložiště i koordinátor běží na jednom stroji přes loopback. Produkční vzdálené úložiště, dva fyzické stroje a skutečná nezávislá časová služba zatím ověřené nejsou.

## Návrh pro dva stroje

1. **Zdroj a doručení.** Schválený exportér na stroji A čte pouze potřebné sloupce a vzdáleně ukládá podepsaný balíček do neveřejného úložiště. Pro objekt použije klíč odvozený z SHA-256 a zápis pouze při neexistenci klíče. Výběr povoleného otisku se předává z důvěryhodného indexu. Recepce na stroji B má krátkodobé oprávnění GET na konkrétní objekty a žádné oprávnění k publikaci, výpisu nebo mazání. Příkladem je oddělený S3 bucket s blokovaným veřejným přístupem, verzováním, zákazem přepsání pro exportéra, podmínkou `If-None-Match: *` a vhodnou retenční politikou Object Lock. [Podmíněné zápisy](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html) · [Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
2. **Koordinace.** Vyhrazená služba mimo oba pracovní stroje drží autoritativní transakční evidenci. Úložiště a koordinátor mají odlišné identity. Vzdálení pracovníci předávají balíček úzkému autentizovanému rozhraní. V produkci použijte trvalý transakční backend nebo vyhrazeného jediného zapisovatele s ověřenou obnovou. Nesdílejte soubor SQLite přes síťový disk. Zálohy a oddělený kontrolní bod obsahují poslední potvrzené pořadí nebo otisk a verzi registru. Před obnovou po ztrátě autority srovnejte zálohu s nezávislým kontrolním bodem. Ztráta nebo pochybnost o aktuální autoritě zastaví příjem. Samotný lokální registr neodhalí výměnu celé databáze za konzistentní starší kopii.
3. **Čas a klíče.** Nezávislý svědek mimo správu exportéra přepočítá CAL-12 ze zdrojových dat a podepíše potvrzení na svých ověřených hodinách. Pro vyšší důvěru posuďte nezávislou TSA dle RFC 3161, její certifikační politiku, přesnost času a dlouhodobé ověření. V obou případech doklad musí předcházet plánovanému i skutečnému začátku NHL. Kořenový podpisový klíč drží oddělený správce mimo běh. Provozní podpisové klíče uložte do oddělené správy, s nacvičenou rotací, incidentním odvoláním a přezkumem historických dokladů. [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html)

## Provozní omezení

CAL-13 připravuje ověřitelný transport a koordinátor pro syntetické balíčky. Živý job je vypnutý. Před jeho schválením zbývá schválený přístup ke zdrojům pouze pro čtení, privátní doručování skutečných objektů, vzdálený koordinátor, oddělená správa klíčů a času a zkouška obnovy s nezávislým kontrolním bodem. Počet historických predikcí se testy nemění.

```bash
node --experimental-sqlite --test scripts/test_core43_cal13_infrastructure.cjs
```
