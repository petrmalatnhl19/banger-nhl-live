# CORE43-CAL-17 — bezpečnostní brána před pilotem (návrh)

Stav: **pouze příprava, žádný živý sběr ani schválení pilotu**. Navazuje na CAL-13 až CAL-16 v Draft PR #230. Žádná změna produkčního CORE 4.2, žádné zápisy do Supabase a žádné nasazení.

## Brána A — nezávislé časové potvrzení RFC 3161
- [ ] Určit provozovatele TSA, doložit nezávislou správu klíčů a hodin, politiku OID, důvěryhodný kořen a fingerprint podpisového certifikátu.
- [ ] Z testovacího klienta vyžádat razítko pro SHA-256 **přesných bajtů podepsané obálky**; uložit původní obálku, TSQ, TSR, certifikační řetězec a konfigurační profil. Nikdy neodesílat samotná citlivá vstupní data TSA.
- [ ] Offline znovu ověřit podpis, nonce, otisk, TSA politiku, EKU timeStamping, certifikát a horní mez nejistoty. Zaznamenat postup kontroly odvolání a dlouhodobé archivace (LTV).
- [ ] Negativní scénáře: jiná obálka, změněný nonce, nepovolená politika, nedůvěryhodný kořen, prošlý či odvolaný certifikát, nejistota mimo limit, razítko v čase začátku nebo později.
- [ ] Odděleně ověřit oficiální skutečný začátek zápasu; bez něj **nezařazovat** predikci do historického skórování.

## Brána B — schválený zdroj předzápasových dat
- [ ] Určit vlastníka zdroje, licenci/podmínky přístupu a přesný seznam pěti tabulek a 30 povolených sloupců z CAL-07.
- [ ] Nevyužívat `service_role` ani privilegovanou databázovou roli. Dřívější CAL-06 prokázal nebezpečné dědění oprávnění `PUBLIC` ke schématu `net`; migraci nespouštět bez samostatného schválení bezpečnostní opravy.
- [ ] Exportér provozovat odděleně s minimálními oprávněními; zaznamenat čas čtení, původ a kontrolní otisky. Veřejný GitHub runner nesmí dostat produkční tajné klíče.
- [ ] Nezávisle ověřit, že export nemůže provést INSERT/UPDATE/DELETE, RPC zápis ani volat `net.http_post`.

## Brána C — dva fyzicky nezávislé stroje
- [ ] Připravit privátní HTTPS/mTLS s oddělenými certifikáty pro odesílatele a příjemce; nepoužívat stejný hostitel jako náhradu produkčního testu.
- [ ] Prověřit kontrolu server identity, CA pinning, expiraci, rotaci a odvolání certifikátů; omezit síťová pravidla na nezbytné adresy.
- [ ] Otestovat výpadek po trvalém uložení a před potvrzením. Opakované doručení musí vrátit `duplicate`, nikoli vytvořit další čtyři varianty.
- [ ] Ověřit obnovu SQLite i důkazů (obálka/TSQ/TSR) na druhém stroji a zachování atomického uložení.

## Brána D — měřitelný pilot
- [ ] Vybrat **jeden budoucí zápas** až po dokončení bran A–C a výslovném schválení.
- [ ] Před začátkem neměnně archivovat CORE 4.2 a všechny čtyři varianty CORE 4.3 se stejnými vstupy, časovým důkazem a jednoznačným ID zápasu.
- [ ] Po utkání nezávisle doplnit oficiální skutečný začátek a konečný výsledek; neověřené nebo pozdní predikce označit jako nezpůsobilé.
- [ ] Zveřejnit počet způsobilých dvojic, pokrytí, výjimky a metriky pouze na shodném vzorku. Jeden zápas neprokazuje lepší přesnost CORE 4.3.

## Zastavovací podmínky
Chybějící nezávislá TSA, nejasné oprávnění ke zdroji, použití service_role, nedůvěryhodný certifikát, chybějící skutečný začátek, neúplný archiv nebo nedoložená deduplikace = **STOP**. Nepovolovat živý sběr ani automatické přepnutí workflow. Veškeré zkoušky dosud probíhaly se syntetickými daty.

## Co CAL-17 v této podobě dokládá
Tento dokument je **kontrolní plán**, nikoli důkaz úspěšného externího TSA testu, spojení dvou fyzických strojů, dostupnosti bezpečné produkční čtecí identity nebo provozní připravenosti.