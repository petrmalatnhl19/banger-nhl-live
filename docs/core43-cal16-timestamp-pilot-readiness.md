# CORE43-CAL-16 nezávislé časové potvrzení

Výchozí [Draft PR #230](https://github.com/petrmalatnhl19/banger-nhl-live/pull/230) byl na commitu `427eb2dd217d2f2c3d80944278e9ba7e1a72a504` a všech pět běhů Actions bylo úspěšných. Živý job zůstává vypnutý.

| Audit | Co je ověřeno | Co zbývá |
| --- | --- | --- |
| CAL-13 | Podpisy exportu a svědka, role, registr klíčů, neměnný digest a transakční deduplikace. | Registr identifikuje signatáře. Nezávislá autorita času dosud nebyla připojena. |
| CAL-14 | Syntetický balíček prošel mezi dvěma virtuálními stroji přes artefakt Actions. | Přímý privátní HTTPS transport mezi samostatnými stroji zůstává k ověření. |
| CAL-15 | Přímé mTLS mezi síťovými prostory na jednom virtuálním stroji. Oddělené čtecí a předávací identity, souběh a obnova SQLite. | Oba síťové prostory sdílely jeden systém a testovací soubory. |

## Ověření časového důkazu

1. Odesílatel sestaví přesné bajty obálky CAL-13. Obálka obsahuje původní podpis, vstupy z CAL-07, všechny čtyři varianty a podepsané potvrzení svědka CAL-12. Žádost RFC 3161 používá SHA-256 celé obálky a čerstvý nenulový nonce. Časové autoritě odchází žádost s otiskem.
2. Offline ověřovač vyžaduje formát TimeStampResp se stavem `Granted`, SHA-256, schválenou politiku TSA, platný řetězec k předem nastavené CA a připnutý otisk skutečného podpisového certifikátu. OpenSSL ověří odpověď proti přesné archivované žádosti i proti samostatně vypočtenému otisku obálky. Tím se kontroluje také nonce a podpis nad časem. [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html) · [OpenSSL ts](https://docs.openssl.org/3.5/man1/openssl-ts/)
3. Profil vyžaduje deklarovanou nejistotu času v razítku v rámci schváleného limitu. K podepsanému času přičte nejistotu a zaokrouhlí směrem nahoru. Nejzazší čas musí být přísně před plánovaným i skutečným začátkem potvrzeným oficiálními údaji NHL. Shoda se začátkem, chybějící doklad nebo nesouhlas ID, soupeřů či začátku blokuje přijetí. Soubor s výsledkem a začátkem vstupuje nezávisle na balíčku a před importem jej musí ověřit odpovědná osoba. Pokud zápis uvádí skutečný začátek pouze na minutu, použije se začátek této minuty jako konzervativní mez.
4. Teprve po těchto kontrolách předá nové rozhraní obálku koordinátoru CAL-13, který znovu ověří podpisy, aktuální registr a reprodukci všech variant. Shodné opakování vrací `duplicate` a zachovává jednu obálku se čtyřmi variantami. Stávající příjmová rozhraní zůstávají dostupná pro dřívější testy. Nepoužívají se jako vstup k pilotnímu historickému hodnocení.

`verifyTimestamp` ověřuje kryptografickou vazbu a vrací otisk i nejzazší čas. `acceptTimestampedPackage` navíc kontroluje doklad NHL a používá testovací koordinátor CAL-13. Je určen k ověření po získání skutečného začátku. V budoucím pilotu se před zápasem odděleně uloží přesná obálka, žádost a odpověď. Teprve po nezávislém ověření skutečného začátku půjde predikce zařadit k vyhodnocení. Koordinátor prototypu uloží obálku. Produkční uložení razítka, žádosti a výsledku pod společným otiskem stále vyžaduje neveřejný archiv.

## Testovací a skutečná časová autorita

Testy vytvářejí jednorázovou CA a certifikát časové autority s účelem `timeStamping`. Autorita vydává skutečné odpovědi RFC 3161 pomocí lokálních hodin. Vydané důkazy používají výhradně původ `simulation` a režim `test`. Historické rozhraní vyžaduje konfiguraci schválené nezávislé služby a produkční zdroj důkazů. Samotná hodnota `independent` v konfiguraci nedokládá nezávislost. Tu musí zajistit oddělená správa poskytovatele, klíče a hodin.

Profil konkrétní služby musí před pilotem projít ověřením kompatibility. Prototyp ověřuje platnost řetězce k času razítka. Aktuální důvěryhodnost certifikátu, odvolání a dlouhodobé uchování důkazů zatím vyžadují provozní postup. Produkční TSA ani skutečné zápasy se při testech nekontaktují.

```bash
node --experimental-sqlite --test scripts/test_core43_cal16_timestamp.cjs
```

## Podmínky prvního živého pilotu

- Schválený zdroj předzápasových dat pouze pro čtení a nezměněný CORE 4.2. [Kontrolní seznam CAL-15](core43-cal15-network-pilot-readiness.md#kontrolní-seznam-zdroje-skutečných-dat)
- Ověřený privátní transport mezi samostatnými stroji a ověřená obnova koordinátoru a neměnného archivu.
- Schválená nezávislá TSA, její politika, připnutý certifikát a doklad o ověření skutečné služby. Oddělená správa klíčů a postup pro odvolání.
- Výslovně povolený pilot pro jeden budoucí zápas s předzápasovou archivací a následným ověřením oficiálního začátku a konečného výsledku NHL.
