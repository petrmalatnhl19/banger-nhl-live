# CORE-ACCURACY-08 · Bezpečnostní audit pilotu

**BLOCKED** k 16. listopadu 2026. Byla provedena syntetická generálka. Živých sběrů, úplných nezávisle potvrzených snímků a platných párových predikcí je **0**. Nastavení GitHubu a podmínky poskytovatelů vyžadují samostatné doložení.

## Zápas a harmonogram

NHL Gamecenter potvrdil zápas **2026020342**, Dallas Stars venku proti Vegas Golden Knights, NHL datum 17. listopadu 2026. [Oficiální NHL Gamecenter](https://api-web.nhle.com/v1/gamecenter/2026020342/landing)

| Událost | 18. listopadu UTC | 18. listopadu SEČ |
| --- | --- | --- |
| Začátek zápasu | 03:00 | 04:00 |
| Okno sběru | 01:45 až 02:00 | 02:45 až 03:00 |
| Kandidátní spuštění | 01:46 | 02:46 |
| T−60 | 02:00 | 03:00 |

Zápis `46 1 18 11 *` je kandidát v UTC a zahrnuje každoroční opakování. GitHub zpracovává `schedule` pouze z výchozí větve a start může mít zpoždění. Pilot aktuálně omezuje běh na ruční událost na větvi tohoto PR. Automatický start by vyžadoval zvlášť schválený jednorázový spouštěč ruční události na této větvi, kontrolu UTC okna a výslovné povolení pro tento zápas. [GitHub Actions events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## Zdroje a licence

Technická dostupnost a oprávnění se posuzují samostatně. Kontrola dat níže využívá stagingová zjištění ACCURACY-07 a aktuálně potvrzený Gamecenter. Přístup k placeným nebo přihlášeným zdrojům nebyl součástí generálky.

| Zdroj | Technický stav a vazba na utkání | Čas a riziko změny | Oprávnění a záloha |
| --- | --- | --- | --- |
| NHL API · Gamecenter, rozpis, standings, soupisky | **PASS technicky.** Gamecenter před sběrem potvrzuje ID, týmy, čas a stav FUT/PRE. Standings, soupisky a týmové rozpisy se vážou přes tým, sezónu a rozpis konkrétního zápasu. | Živé JSON odpovědi se mění. Sběr ukládá UTC stažení a SHA-256. Souhrnná statistika podléhá kontrole předzápasové dostupnosti. Soupiska je referenční seznam, postavení pro zápas musí doložit preview. | **BLOCKED pro automatizaci**, dokud provozovatel nedoloží povolený přístup a archivaci. K ověření harmonogramu slouží také oficiální denní a týmový rozpis. [NHL Terms of Service](https://www.nhl.com/info/terms-of-service) |
| NHL preview, Stars a Golden Knights | **BLOCKED.** V předběžném průzkumu ACCURACY-07 chybělo odpovídající preview na všech třech kandidátních adresách. Parser vyžaduje přesný zápas, týmy a přiřazení hráčů k NHL ID. | Publikace i revize musí splnit časový limit. Článek může vyjít až po T−60 nebo se může změnit struktura či URL. | Oficiální klubové preview je implementovaná záloha se stejnou kontrolou původu a času. Podmínky NHL vyžadují ověření oprávnění i zde. Samotná sezónní soupiska chybějící sestavy či absence nenahradí. |
| RotoWire prostřednictvím veřejného zrcadla BANGER | **BLOCKED pro zdroj.** Předběžný průzkum našel dostupný feed bez dvojice pro toto NHL ID. Kontroluje se Game ID, tým, soupeř, strana a hráč. | Feed je měnitelný. Potvrzený a očekávaný brankář mají odlišné stavy. Chybějící původ či identita vylučují vstup. | Větev čte RotoWire zrcadlo pouze při samostatném povolení. Veřejná dostupnost zrcadla nedokládá licenci. Záloha je výslovné oznámení v oprávněně získaném oficiálním preview pro obě strany. [RotoWire Terms](https://www.rotowire.com/terms/) |
| BANGER zrcadlo sestav | **WARNING.** Předběžný průzkum našel veřejný feed bez záznamu pro tento zápas. Diagnostické čtení v živém workflow je vypnuté. | Měnitelné a odvozené z jiných zdrojů. Metadata agregace mohou zaostávat. | Původ a oprávnění k dalšímu použití nejsou doložené. Preferovaná záloha jsou licence a doklady dostupnosti u primárního zdroje. |
| Veřejný čtecí archiv CORE v26 a evidence harmonogramu | **WARNING.** Předběžný průzkum viděl čtyři komponenty. GET je omezený na Game ID. Ověřuje se harmonogram, verze a původní hodnoty včetně brankářských faktorů. | Úplná a časově doložená dostupnost v T−60 zůstává neověřená. Jeden průzkum nezaručuje, že archivní záznam nebude dodatečně upraven. | Ověřit právo držet původní odpovědi a původ vstupů třetích stran. Při výpadku či neúplnosti žádné přibližné hodnoty ani zápis do databáze. |

Při automatizaci se dodržuje omezený počet GET, povolené cíle, kontrola přesměrování, časový a velikostní limit a odmítnutí neshody ID nebo času. Živé workflow ukládá původní odpovědi pouze šifrovaně. Veřejný souhrn má diagnostické hodnoty a otisky. Zdroje s odmítnutým přístupem zůstávají vyřazené i v zrcadlech.

## GitHub Actions a klíče

| Kontrola | Stav |
| --- | --- |
| `GITHUB_TOKEN` | **PASS v kódu.** Konfigurace má `contents: read`. Živá úloha má navíc `actions: read` pro metadata artefaktů. Token se předává pouze kroku čtení GitHub API. Checkout neponechá přihlašovací údaje. |
| Volání a vstupy | **PASS v kódu.** Konfigurační režim pouze testuje. Živý režim vyžaduje správný repozitář, větev, ruční událost, explicitní identifikátor aktivace a povolení zdrojů. Uživatelský vstup nevstupuje do shellu. Použité akce pilotu jsou připnuté na SHA. |
| Secrets a nastavení repozitáře | **BLOCKED.** Na tomto přístupu nelze ověřit existenci klíčů, pravidla prostředí, výchozí oprávnění repozitáře ani povolené akce. Vlastník zkontroluje prostředí, výchozí token jen pro čtení, zákaz předávání Secrets z nedůvěryhodných PR a případnou možnost obejít schválení. |
| Logy a šifrování | **PASS v generálce.** CLI používá bezpečné obecné chyby. Klíče jsou pouze v prostředí kroků, kde jsou potřeba. Původní odpovědi drží AES-256-GCM. Hlavičky s přístupovými údaji a soukromé podpisové klíče se do logů nepředávají. |
| Souběh, přerušení a retence | **PASS v generálce.** Stejná skupina souběhu, žádné automatické rušení probíhajícího pokusu. Před sběrem musí existovat rezervace. Hotový archiv blokuje druhý výpočet. Rezervace bez potvrzené diagnostiky blokuje opakování do kontroly operátorem. V důkazu posoudit i retenci a případný zásah oprávněných osob. |

Ověřit původ neuzavřené rezervace, číslo pokusu, logy, stav uploadu a existenci šifrovaného artefaktu. Při nejasnosti běh považovat za přerušený. Operátor před další akcí pořídí záznam mimo přepisovatelný artefakt. Smazání artefaktu samo o sobě nepotvrzuje možnost opakování.

### Nastavení vlastníkem po schválení

1. Vytvořit chráněné prostředí `accuracy-pilot` s povolenou pouze větví `core-accuracy-lab-01`, povinným nezávislým schválením a zákazem schválit vlastní běh. Tam, kde nastavení běh nechrání, pilot ponechat **BLOCKED**.
2. Na důvěryhodném počítači s vypnutým trasováním shellu vytvořit nový adresář mimo pracovní strom. Použít správce tajemství pro zálohu. Ed25519 podepisuje manifest a návaznost výstupů. AES-256 klíč šifruje původní odpovědi a výstupy. Externí časové razítko používá veřejný řetězec TSA a lokálně vytvořený otisk.

   ```sh
   node accuracy-lab/pilot-keys.cjs generate /private/pilot-keys-new
   gh secret set ACCURACY_PILOT_SIGNING_KEY --env accuracy-pilot < /private/pilot-keys-new/signing.pem
   gh secret set ACCURACY_PILOT_ARCHIVE_KEY --env accuracy-pilot < /private/pilot-keys-new/archive.hex
   gh variable set ACCURACY_PILOT_SIGNER_SHA256 --env accuracy-pilot --body "$(jq -er .signingSpkiSha256 /private/pilot-keys-new/pins.json)"
   gh variable set ACCURACY_PILOT_ARCHIVE_SHA256 --env accuracy-pilot --body "$(jq -er .archiveKeySha256 /private/pilot-keys-new/pins.json)"
   ```

3. Zveřejnit ověřovatelům pouze `signing-public.pem` a jeho SHA-256 odděleným důvěryhodným kanálem spolu s datem účinnosti. Ověřit archiv s očekávaným otiskem pomocí `verifyArchive(archive, expectedSignerSha256)`. Bez předaného otisku funkce provádí kontrolu integrity vůči klíči uloženému v archivu.
4. Při rotaci nejdřív vypnout `ACCURACY_PILOT_ACTIVATION`, zapsat důvod a čas zneplatnění, vyměnit oba Secrets i jejich otisky a ověřit nové klíče. Uchovat dřívější veřejné otisky, dobu oprávnění a stav odvolání pro historická ověření. Předchozí šifrovací klíč uchovat zabezpečeně pro autorizovaný přístup ke starým archivům. Při kompromitaci okamžitě vypnout aktivaci, zrušit nevyřízené spuštění a zneplatnit příslušný klíč v evidenci. Nepřijímat nové podpisy z odvolaného klíče.

## RFC 3161

Archivovaná odpověď FreeTSA k dřívější náhodné testovací výzvě prošla offline kontrolou řetězce, vydavatele podpisu, nonce původní žádosti a samostatně spočteného SHA-256. Čas byl `2026-11-16T10:40:22Z`. Podepsaný CRL byl platný od 18. září 2026 do 18. září 2027 a ověření proti němu k času podpisu prošlo. Leaf certifikát obsahuje CRL distribuční bod. OCSP se při tomto běhu neověřovalo. Poskytovatel nezaručuje dostupnost služby a vzorek uváděl `Accuracy: unspecified`. Doložení maximální odchylky a schválené důvěry ke kořeni i TSA podepisujícímu certifikátu chybí. [FreeTSA](https://www.freetsa.org/index_en.php)

Offline auditor `tsa-audit.cjs` ověřuje podepsaný export, předložený řetězec, identitu certifikátu, nonce, SHA-256, čas a případný CRL. Počítá konzervativní horní hranici času, pokud má autorita deklarovanou přesnost. Uvádí technickou platnost zvlášť od stavu **BLOCKED** a nemění počet platných párů. Při výpadku nebo chybě razítka zůstane výsledek interně archivovaný. Podpis a razítko samy nedokládají původ jednotlivých vstupů.

```sh
node accuracy-lab/tsa-audit.cjs export.json response.tsr ca.pem tsa.pem crl.pem
```

Alternativní TSA vyžaduje ověření účelu, podmínek, deklarované přesnosti, připnutých certifikátů, revokací a výpadku služby. DigiCert dokumentuje veřejné rozhraní pro Authenticode. Použitelnost pro pilot tím doložena není. Tento audit žádnou novou časovou žádost neodeslal. [DigiCert Timestamping](https://knowledge.digicert.com/general-information/rfc3161-compliant-time-stamp-authority-server)

## Generálka a přehled

```sh
node --test accuracy-lab/*.test.cjs
python3 -B -m unittest discover -s accuracy-lab -p test_collect.py
node accuracy-lab/pilot-readiness.cjs /tmp/core-accuracy-08-report.json
```

V Accuracy Lab použít **Načíst report** a vybrat vygenerovaný JSON. Přehled zobrazuje čas testu a stavy PASS, BLOCKED a WARNING bez údajů z klíčů. Syntetické scénáře zahrnují chybějící sestavu, očekávaného brankáře bez záměny za potvrzeného, špatné Game ID, pozdní stažení, pozdní publikaci komponenty, nedostupné API, neplatný podpis a razítko, rezervaci, výpadek zápisu a chybějící Secrets.

## Podmínky aktivace

1. **BLOCKED** Doložit oprávnění k automatickému získání a archivaci všech nutných zdrojů. RotoWire povolit jen při doloženém souhlasu nebo použít autorizované oficiální preview s oběma brankáři.
2. **BLOCKED** Ověřit chráněné prostředí, pravidla a oba Secrets s jejich otisky. Zkontrolovat správce repozitáře a povolené Actions.
3. **BLOCKED** Mít časově doložitelné sestavy, absence, obě výslovně identifikované brankářské volby, původní brankářské faktory a všechny komponenty přesného přepočtu v T−60.
4. **BLOCKED** Schválit nezávislou TSA s ověřeným řetězcem, revokacemi a deklarovanou přesností. Technický test FreeTSA tento bod nesplňuje.
5. **WARNING** Teprve poté schválit jednorázový konkrétní čas a způsob spuštění. Po doložení oprávnění nastavit `ACCURACY_PILOT_SOURCES_ALLOWED=true` a případně `ACCURACY_PILOT_ROTOWIRE_ALLOWED=true` v chráněném prostředí. Po výslovném schválení pro tento zápas lze nastavit `ACCURACY_PILOT_ACTIVATION=accuracy-pilot-2026020342-20261118T0200Z`. Runner musí být v okně a při přeplánování ověřit nový harmonogram. Aktivaci po pokusu odstranit.
