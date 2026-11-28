# CORE43-CAL-33 — Audit a zkouška přípravy pilotu

Výchozí commit `c9ac69796c5cc648bb67a328539bfbd62577af3c` měl v otevřeném Draft PR #230 úspěšných všech pět workflow. CAL-29 ověřuje dva tokeny a jejich vazbu na balíček v offline režimu. CAL-30 navíc kontroluje schválenou politiku, odlišné provozovatele a klíče, podepsaný balíček a svědka, revokaci a nezávisle podepsaný čas NHL. CAL-31 přehrává archiv offline. CAL-32 vytváří dva různé požadavky před plánovaným začátkem. CAL-33 doplňuje získání, archivaci a ověření původu NHL podkladů a produkuje beze změny formátu původní objekt `nhlStart` pro CAL-30 a CAL-31.

## Časové autority

Kontrola veřejných materiálů a podepsaných CRL proběhla 16. listopadu 2026. Pro RFC 3161, OID a přesnost se audit opírá o skutečné odpovědi z CAL-31. Při CAL-33 proběhlo nové stažení CRL a ověření již známých řetězců. K autoritám teď neodešel žádný nový požadavek o vydání razítka.

| Oblast | GlobalSign R45 | Sectigo Qualified |
| --- | --- | --- |
| Provozovatel | Belgická GlobalSign nv-sa ze skupiny GMO. Dokumentace připouští provozní zapojení přidružených subjektů. | Španělská Sectigo (Europe) S.L. Španělský seznam EU uvádí službu Sectigo Qualified Time Stamping CA R35. |
| Endpoint, OID a přesnost | `timestamp.globalsign.com/tsa/r45standard`, pozorovaný OID `1.3.6.1.4.1.4146.2.3.2.2`. RFC 3161, SHA-256 a podepsaná odchylka ±1 sekunda. Endpoint je v návodu pro podepisování kódu. | `timestamp.sectigo.com/qualified`, pozorovaný OID `0.4.0.2023.1.1`. RFC 3161, SHA-256 a podepsaná odchylka ±1 sekunda, jak uvádí i dokumentace poskytovatele. |
| Řetězec a platnost do (UTC) | Globalsign R45 TSA for CodeSign 202510 (10. 1. 2037) → GlobalSign Offline R45 Timestamping CA 2025 (16. 7. 2041) → samopodepsaný GlobalSign Timestamping Root R45 (18. 3. 2045). | Sectigo Qualified Time Stamping Signer #3 (2. 8. 2034) → Sectigo Qualified Time Stamping CA R35 (4. 10. 2035) → samopodepsaný Sectigo Qualified Time Stamping Root R45 (4. 10. 2045). |
| Stav odvolání | Kontrola řetězce a obou podepsaných CRL k datu auditu prošla. Obě zveřejněné CRL měly `nextUpdate` 15. 1. 2027 00:00 UTC. | Kontrola řetězce a obou podepsaných CRL k datu auditu prošla. `nextUpdate` byl 23. 11. 2026 01:16:31 UTC pro seznam vystavitele signatáře a 23. 11. 2026 05:39:56 UTC pro seznam vystavitele mezilehlého certifikátu. |
| Podmínky a cena | Obecný TPS připouští veřejné i uzavřené použití a počítá se smluvním vztahem předplatitele. Pro konkrétní kombinaci endpointu, pozorovaného OID a archivace predikcí nebylo potvrzeno oprávnění, cena, limity ani SLA. | Disclosure Statement připouští použití důkazu existence dat a uvádí možnost poplatků. Nebyla potvrzena konkrétní cena, limity ani smluvní podmínky pro BANGER. |

Prameny pro GlobalSign. [TPS](https://www.globalsign.com/en/repository/GlobalSign_TPS.pdf) · [veřejné kořeny](https://support.globalsign.com/ca-certificates/root-certificates/globalsign-root-certificates) · [návod k endpointu](https://support.globalsign.com/digital-certificates/digital-certificate-installation/timestamping-microsoft-windows) · [korporátní dokumenty](https://www.globalsign.com/en/company/corporate-policies)

Prameny pro Sectigo. [TSPPS v1.1.4](https://www.sectigo.com/uploads/files/eIDAS/Sectigo_eIDAS_TSPPS_v1.1.4.pdf) · [Disclosure Statement v1.0.6](https://www.sectigo.com/uploads/legal/eIDAS/Sectigo-eIDAS-TSA-Disclosure-Statement-1.0.6.pdf) · [španělský seznam EU](https://eidas.ec.europa.eu/efda/trust-services/browse/eidas/tls/tl/ES)

Odlišné právnické osoby, kořeny a podpisové klíče dokládají organizační a kryptografické oddělení. Oddělení provozu, správy HSM, infrastruktury a časových zdrojů mezi konkrétními službami z veřejných materiálů doložené není. Sectigo popisuje více zdrojů UTC(k), což samo neprokazuje oddělení od GlobalSign. Řetězce jsou ověřené proti konkrétním kořenům, nikoli obecnou či budoucí důvěrou v libovolný certifikát poskytovatele. Před skutečným pilotem je potřeba nezávislé schválení obou profilů, podmínek použití a cen nebo potvrzení bezplatnosti. [Otisky GlobalSign](core43-cal30-tsa-candidates.json) · [otisky Sectigo](core43-cal31-pilot-rehearsal.md#candidate-authorities)

## NHL podklad a jeho integrita

- Samostatný ověřovatel po utkání stáhne HTML Game Summary a JSON boxscore přes HTTPS. Nástroj má dvě pevně odvozené adresy podle ID utkání, odmítá přesměrování a omezuje velikost a čas stažení. Archiv uchovává originální těla odpovědí, adresy, časy dokončení stažení a SHA-256.
- Boxscore slouží k ověření identity, týmů, finálního stavu a **plánovaného** času. **Skutečný** čas musí být v hlavičce finálního Game Summary uvedený jako začátek. U nejasného časového pásma, rozporu mezi podklady, nejasného dopoledního či odpoledního času nebo nepodporovaného formátu odlož podpis do nezávislého dořešení. Nástroj kontroluje explicitní značku, datum, časové pásmo, týmy i minutu. Zápis s dvanáctihodinovým formátem ověřovatel doplní samostatně doloženou interpretací. Pole `clockCorroboration` je podepsaný záznam této lidské kontroly.
- Po přezkumu ověřovatel podepíše čas pod samostatným klíčem Ed25519. Druhý podpis váže přesné bajty zdrojového archivu, podpis dokladu NHL a normalizovaný záznam. Ověř ho nezávisle získaným veřejným klíčem. NHL HTML a časy stažení jsou dosvědčené ověřovatelem. Nástroj sám jim nepřiděluje `trusted: true`.
- Při zkoušce s dočasným klíčem byl u zápasu Chicago–Florida `2025020001` plánovaný začátek 21:00 UTC a skutečný začátek 21:20 UTC dne 7. října 2025. Boxscore byl získán 16. listopadu 2026 v 07:16:43.023 UTC a report v 07:16:45.639 UTC. Otisky odpovídaly doloženým bajtům z CAL-31. Ověření původu prošlo. Přehrání původních pozdních razítek přes CAL-31 po výměně dokladu opět vrátilo `cal30_timestamp_order` a `trusted: false`. [NHL Game Summary](https://www.nhl.com/scores/htmlreports/20252026/GS020001.HTM) · [NHL boxscore](https://api-web.nhle.com/v1/gamecenter/2025020001/boxscore)

Na stroji ověřovatele používej soukromý pracovní adresář bez přepisování důkazů. Soubor `review.json` obsahuje `actualStartAt` jako přesný počátek doložené minuty v UTC a `clockCorroboration` s odkazy na podpůrný zdroj a odůvodněním interpretace.

```sh
umask 077
set -C
node scripts/core43_cal33_nhl_observer.cjs collect "$NHL_GAME_ID" > sources.json
node scripts/core43_cal33_nhl_observer.cjs attest sources.json review.json observer-private.pem > attestation.json
node scripts/core43_cal33_nhl_observer.cjs verify sources.json attestation.json observer-public.pem
```

Přenášej `sources.json`, `attestation.json` a veřejný klíč získaný důvěryhodnou cestou. Soukromý klíč zůstává u ověřovatele. Do CAL-31 dossier vlož objekt `nhlStart` z `attestation.json` a celý zdrojový archiv ponech pro audit. CAL-31 ověřuje původní CAL-30 podpis dokladu. Podpis podrobné provenience ověřuje samostatný příkaz CAL-33.

## Postup budoucího pilotu

1. Po schválení konfigurace vyber jediný budoucí zápas, ulož oficiální plánovaný začátek a připni jeho CAL-32 plán.
2. Před zápasem vytvoř výstup CORE 4.3 v izolovaném schváleném procesu. Po podpisu exportu a svědka zachovej přesný neměnný balíček CAL-13.
3. Připrav dva požadavky přes CAL-32. V autorizovaném běhu odešli jednotlivým schváleným TSA jen odpovídající surové požadavky. Obě odpovědi musí vzniknout před začátkem. Archivuj balíček, registr, připnutý plán, oba původní požadavky i odpovědi a příslušný stav certifikátů.
4. Po zápase obstarej nezávislý podepsaný doklad CAL-33 včetně zdrojového archivu a ověř jeho provenienci. Použij dřívější z plánovaného a skutečného začátku.
5. Sestav dossier CAL-31 a přehraj ho offline s odděleně připnutou politikou CAL-30. Uchovej výsledek, čas přezkumu a otisk politiky. Do auditu zapiš, které důkazy byly zkontrolovány a zda případ zůstal `trusted: false`.

## Regrese a CAL-34

Automatizované kontroly pokrývají chybějící a rozbitá razítka, duplicitního provozovatele, upravené podpisy a bajty balíčku, neplatné, expirované a odvolané certifikáty, chybějící či nejednoznačný zdroj skutečného času, razítka na časové hranici nebo po ní a použití podepsaného dokladu pro jiné ID nebo soupeře. Test CA, podpis ověřovatele v historické zkoušce a celý testovací balíček jsou simulace.

Před CAL-34 chybí potvrzené smluvní podmínky obou TSA, doložené provozní oddělení, samostatně spravovaný klíč nezávislého ověřovatele a schválené politiky pro jeden případ. Pro CAL-34 doplň nezávislé schválení a důkazní balíček s příjmovým manifestem, který automaticky porovná archiv žádostí CAL-32 se skutečnými vstupy CAL-31. Kladný živý pilot plánuj teprve se schválenými poskytovateli a budoucím zápasem.
