# CORE43-CAL-15 síťová zkouška a připravenost pilotu

Výchozí [Draft PR #230](https://github.com/petrmalatnhl19/banger-nhl-live/pull/230) byl na commitu `1ad3ba2` a všech pět běhů Actions bylo úspěšných. Živá úloha CAL-04 zůstává vypnutá.

## Audit a rozsah ověření

| Část | Závěr |
| --- | --- |
| CAL-13 | TLS ověřoval server. Přístup k objektu a předání koordinátoru používaly odlišné tokeny. Identitu klienta při přístupu prokazoval pouze token. Koordinátor už měl transakční deduplikaci a ověření podpisů. |
| CAL-14 | Podepsaný syntetický artefakt přešel mezi dvěma virtuálními stroji přes GitHub Actions. Přímé TLS běželo lokálně na přijímacím stroji. |
| CAL-15 | Režim mTLS přidává dva různé klientské certifikáty a váže každý certifikát i token k jeho roli. Producent a časový svědek mají nadále oddělenou identitu Ed25519 v podepsaném registru CAL-13. |

Zkouška CAL-15 používá dva procesy a skutečné síťové spojení přes TLS. V izolovaném režimu má každý proces jiný Linux síťový prostor. Privátní spoj vede přes pár virtuálních rozhraní bez připojení k externí síti. Oba prostory sdílejí jeden systém a testovací soubory. Zkouška na dvou nezávislých strojích zůstává samostatným předpokladem pilotu.

Zkouška kontroluje odmítnutí nedůvěryhodné certifikační autority, certifikátu se špatnou adresou, chybějícího klientského certifikátu a záměny rolí u certifikátů a tokenů. Poškozený objekt neprojde SHA-256. U souběžných požadavků se jeden zápis potvrdí a jeho odpověď se záměrně ztratí. Ostatní požadavky vrátí duplicitu. Po restartu konzistentní evidence stále obsahuje jediný potvrzený balíček se všemi čtyřmi variantami.

```bash
# Dva procesy přes loopback bez administrátorských oprávnění.
node --experimental-sqlite --test scripts/test_core43_cal15_network.cjs

# Dvě izolované privátní sítě na jednorázové Linux VM s iproute2 a sudo.
bash scripts/core43_cal15_netns.sh
```

### Přímá zkouška na dvou samostatných strojích

Navazujte na [postup CAL-14](core43-cal14-two-host-rehearsal.md#přímá-zkouška-v-privátní-síti) a přidejte následující nastavení. Použijte vlastní jednorázovou testovací CA, serverový certifikát s odpovídajícím SAN a dva klientské certifikáty pro oddělené role. Host A má klíč serveru, veřejný certifikát klientské CA a otisky klientských certifikátů. Host B má veřejnou serverovou CA a dva klientské klíče. Klíče nepřenášejte v artefaktech.

- V `authority.json` nastavte `clientCaPath` a `peerPins` s klíči `read` a `submit`. Hodnotou je SHA-256 otisk příslušného certifikátu v podobě vracené příkazem `openssl x509 -noout -fingerprint -sha256` po odebrání prefixu. Režim vyžaduje platný klientský certifikát i příslušný token.
- V `receiver.json` nastavte `readClient` a `submitClient`. Každý objekt obsahuje `certPath` a `keyPath`. `certPath` na nejvyšší úrovni zůstává cesta k serverové CA. K privátním klíčům a konfiguračním souborům má přístup pouze jejich provozní účet.
- Výsledek zdokumentujte podle pořadí v CAL-14. Zapište identifikaci obou strojů, adresu testovacího cíle, otisk syntetického balíčku, očekávané odmítnutí cizí role, ztracenou odpověď a výsledek opakování po restartu. Citlivé údaje z evidence vynechte.

## Kontrolní seznam zdroje skutečných dat

- [ ] Vlastník zdroje písemně schválil konkrétní projekt, rozhraní, síť, provozní identitu pouze pro čtení a použití pro jeden pilotní zápas.
- [ ] Export je omezen na pět projekcí a 30 sloupců z [CAL-07](core43-cal07-signed-pregame-export.md). Ověřený zápasový rozsah platí i při filtrování, stránkování a chybě zdroje.
- [ ] Ověřené efektivní granty včetně `PUBLIC`, rolí, schémat, tabulek, sekvencí a funkcí. Přístup přes `net`, zápis, vytváření objektů a neplánované funkce jsou uzavřené. Kontroly odmítnutí se provádějí v odděleném testovacím prostředí. [Zabezpečení Supabase API](https://supabase.com/docs/guides/api/securing-your-api) · [Audit CAL-06](core43-cal06-readonly-readiness-audit.md)
- [ ] Vydávání a odvolání časově omezené exportní identity je ověřené. GitHub Actions nedostává databázové přihlašovací údaje. Záznamy o přístupu neobsahují tajné hodnoty ani kompletní balíčky.
- [ ] Reprezentativní export prokáže čerstvou archivovanou sestavu vstupů, nezměněný předzápasový CORE 4.2 a všechny čtyři varianty ve stanoveném okně. Pozdní, neúplný nebo neprokazatelný vstup pilot zastaví.
- [ ] Před aktivací jsou samostatně schválené soukromé doručení, oddělené klíče, dlouhodobá evidence s kontrolním bodem a zkouška obnovy na dvou samostatných strojích.

## Návrh nezávislého časového potvrzení

Časový svědek CAL-12 mimo správu exportéra ověří podpis původního exportu a zopakuje výpočet všech variant. Svědek připojí čas a podpis k přesnému SHA-256 balíčku. Pro produkční pilot lze k tomu získat potvrzení RFC 3161 od nezávislé časové autority. K ní odejde otisk, nikoli obsah predikce. Požadavek, odpověď a potřebné ověřovací údaje se archivují s potvrzeným balíčkem. [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html)

Přijímač před použitím ověří podpis a řetězec autority, důvěryhodnou politiku TSA, shodu otisku i nonce a případnou nejistotu času. Použije nejzazší věrohodný čas potvrzení a po dohrání ho porovná s plánovaným i skutečným začátkem NHL. Časovou autoritu, její klíče a ověření v izolovaném provozu je potřeba schválit. Syntetický test CAL-15 ověřuje podpis CAL-12, skutečná TSA není připojená.

Živý pilot čeká na schválený zdroj, privátní transport mezi dvěma stroji, nezávislé potvrzení a výslovné povolení jednoho budoucího zápasu. Syntetické objekty zůstávají mimo historický vzorek.
