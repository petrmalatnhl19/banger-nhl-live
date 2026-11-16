# CORE-ACCURACY-07 – ruční Actions pilot a audit

Navazuje na [Draft PR #258](https://github.com/petrmalatnhl19/banger-nhl-live/pull/258) od commitu `b2b9ef6ca7f054ef563cf7d257bfd815ddbc8934`. Na výchozím HEAD prošly obě kontroly. Změny jsou omezené na laboratoř a její testovací vstupy a workflow. [Ruční pilot etapy 06](LIVE-PILOT.md) · [Přesný ensemble v26](V26-OFFLINE.md)

## Ověřený zápas a stav zdrojů

NHL Score, Gamecenter Landing a klubový rozpis Dallasu shodně vrátily zápas `2026020342`, Dallas Stars jako hosty, Vegas Golden Knights jako domácí a NHL zápasový den 17. listopadu. Plán je **18. listopadu 2026 03:00 UTC / 04:00 SEČ**, okno **01:45–02:00 UTC / 02:45–03:00 SEČ**. Konfigurace se nezměnila. Při živém běhu se před dalším sběrem znovu ověří Gamecenter i NHL Score. [NHL Score](https://api-web.nhle.com/v1/score/2026-11-17) · [NHL Gamecenter](https://api-web.nhle.com/v1/gamecenter/2026020342/landing) · [Rozpis Dallasu](https://api-web.nhle.com/v1/club-schedule-season/DAL/20262027)

| Zdroj | Skutečně zjištěný stav před oknem |
| --- | --- |
| NHL Score, Gamecenter a rozpis Dallasu | Shodný Game ID, týmy a čas. |
| NHL Standings a sezonní rozpisy obou týmů | Zachyceny v předčasné diagnostice etapy 06 včetně hodnot pro týmové statistiky a odpočinek. |
| Veřejné archivní GET a archivní rozpis | V diagnostice byly čtyři verzované komponenty v26, `goalie32_factors` a shoda rozpisu. Znovu se ověří časy, stav `pending`, týmy, verze a otisky. |
| Domácí výhoda | Připnutá konfigurace v26. Při replay se už podruhé neuplatňuje. |
| NHL preview, Vegas klubové preview, Dallas klubové preview | Dne 16. listopadu jednotlivé ověřené URL vedly na „not found“. Článek neexistoval na kontrolovaných adresách v tomto okamžiku. Pozdější obsah zůstává neznámý. |
| Sezonní soupisky NHL a zrcadlo sestav BANGER | Staženy v diagnostice. Soupiska sama nedokládá sestavu nebo absenci v konkrétním utkání. |
| Zrcadlo brankářů RotoWire | Snapshot `2026-11-16T09:43:07.173575Z` obsahoval 90 řádků, žádný s Game ID `2026020342`. Samotná síťová odpověď tedy byla dostupná. |

Nová záloha sestav a absencí vyzkouší přesně svázané varianty kanonického preview na webech obou klubů NHL. Ověřuje vydavatele, kanonické URL, stejný zápas a odpovídající čas. Pokud zrcadlo RotoWire nedá úplný pár, preview může doložit brankáře jen explicitní větou pro každou stranu a shodou s NHL ID na příslušné soupisce. Formulace „will start“, „expected“ a „projected“ zůstávají projekcí. Potvrzení vyžaduje výslovný údaj. Pořadí dvou jmen a samotná soupisková přítomnost k určení startu nestačí. Alternativní komerční weby jsou vhodné pouze po ověření licence či schváleného API. Podmínky NHL zakazují neautorizovaný automatizovaný sběr. Runner proto vyžaduje evidovaný souhlas s použitím zdrojů a nahrává surové odpovědi výhradně v šifrované podobě. [Podmínky NHL](https://www.nhl.com/info/terms-of-service)

## Workflow, opakování a archiv

[CORE Accuracy pilot](../.github/workflows/core-accuracy-pilot.yml) má `workflow_dispatch` a `workflow_call`. Výchozí volba `configuration` pouze ověřuje UTC konfiguraci a lokální scénáře bez živých dotazů. CI volá tuto volbu z běžných testů. Živý režim je omezený na ruční událost, tento repozitář, jedinou větev a pevné okno v roce 2026.

- GET může zkusit ještě jeden pokus při dočasné síťové chybě nebo 408/425/429/5xx. Respektuje `Retry-After` a krátkou rezervu do T−60. Stav 403/404 se neopakuje. Každý pokus nese UTC začátek, dokončení a HTTP stav. Skutečně přijaté použitelné odpovědi se uchovají v původních bajtech s SHA-256.
- V souběžných bězích se živé joby pro tento Game ID a T−60 nepřekrývají. Existující artefakt `-sealed` příslušného workflow na správné větvi zastaví další výpočet. Diagnostický artefakt další pokus neblokuje. Terminální ověření může stále zablokovat pozdní start. Lokální výstup používá výhradně nový adresář.
- Chybějící povinná hodnota, rozpisový rozpor, pozdní dostupnost, neznámá verze nebo neplatný otisk znamenají diagnostiku bez predikcí. Úplný interní pár obsahuje původní archiv, všestranně svázaný Gamecenter, společný otisk vstupu, verzi v26, čas výpočtu UTC, dvě skóre, dvě kontrolní SHA-256 a rozdíl 4.1 minus 4.0.
- Živý job nahrává `status.json` a `evidence.encrypted.json`. Surová evidence je chráněna AES-256-GCM se samostatným klíčem operátora. Po stažení ji lze místně otevřít příkazem `node accuracy-lab/pilot-automation.cjs decrypt evidence.encrypted.json evidence.json` při bezpečně načteném `ACCURACY_PILOT_ARCHIVE_KEY`. Podepsaný archiv je v `evidence.json` jako objekt `archived`. Z něj lze lokálně odvodit dosavadní RFC 3161 export. Nezávislá platnost zůstává nulová do skutečného potvrzení.

## Skutečná zkouška bezplatného RFC 3161

[FreeTSA](https://www.freetsa.org/index_en.php) zveřejňuje bezplatný veřejný endpoint a [pravidla využití](https://www.freetsa.org/freetsa.html) uvádějí nejvýše jeden požadavek za sekundu z jedné IP, dostupnost bez SLA a záznam IP kvůli zneužití. Na endpoint šel **jediný testovací TSQ k náhodné výzvě**, bez NHL, modelových dat, účtu či platby. OpenSSL ověřil řetězec, otisk a nonce. Odpověď byla Granted se SHA-256. Chybělo pole deklarované přesnosti (`Accuracy: unspecified`). Bez doložené hranice časové nejistoty ji zatím nelze použít pro posouzení, že razítko včetně nejistoty vzniklo nejpozději v T−60. Otisk testovaného podpisového certifikátu byl `32:E8:41:A9:5C:C1:16:41:01:FF:DE:41:29:8E:F2:FC:75:C1:C4:37:2E:F0:95:E8:8A:6B:BD:47:DF:B1:91:FC`. Produkční důvěra se nenastavovala. Žádost pro zápas nebyla odeslána.

## Aktivace po rozhodnutí uživatele

1. Potvrdit podmínky automatizovaného použití NHL a veřejných zrcadel a zaznamenat souhlas v proměnné repozitáře `ACCURACY_PILOT_SOURCES_ALLOWED=true`. Připravit podpisový Ed25519 klíč a samostatný 32bajtový náhodný klíč uložený hexadecimálně. Hodnoty uložit jen jako Actions Secrets `ACCURACY_PILOT_SIGNING_KEY` a `ACCURACY_PILOT_ARCHIVE_KEY`. Ověřit bezpečný přístup k dešifrování.
2. Pro první běh preferovat ruční spuštění na začátku okna. GitHub vyžaduje registraci workflow na výchozí větvi. V Draftu se samostatný pilot testuje jako reusable workflow. Na větvi je i ruční most z již registrovaného Frontend smoke. Se zápisovým přístupem lze použít `gh workflow run frontend-smoke.yml --repo petrmalatnhl19/banger-nhl-live --ref core-accuracy-lab-01 -f run_accuracy_pilot=true`. Přímé ruční spuštění nového workflow a živý most v tomto běhu ověřeny nebyly. Fallback při nedostupnosti mostu je existující místní postup v [LIVE-PILOT.md](LIVE-PILOT.md). [GitHub ruční trigger](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
3. Kandidát plánu je `46 1 18 11 *` v UTC, tedy **18. listopadu 02:46 SEČ**. Automatický `schedule` a povolení spuštění na tuto událost v kódu nejsou. Před jejich přidáním získat výslovné schválení a samostatné povolení pro registraci na výchozí větvi nebo zvolit povolený externí dispatch. Časová brána je jednorázová pro rok 2026. GitHub může frontu zpozdit, proto se běh po T−60 odmítne. [GitHub schedule a fronta](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
4. Samostatně dohodnout externí důvěru, politiku, podpisový certifikát, časovou nejistotu a ověřit skutečnou odpověď nad jednou svázanou žádostí. Stav „interně archivováno“ zůstává odlišný od externího časového razítka a platného páru.

**Výsledek etapy 07.** Okno ještě nenastalo. Pro Vegas zůstávají chybějící preview a přesně svázaná dvojice brankářů. Úplný živý snímek, skutečné predikce obou modelů ani nezávislý doklad pro zápas nevznikly. Počty jsou **0 úplných ověřených snímků T−60 a 0 platných párů**. Syntetické testy ověřují postup a tyto počty nemění.

Aktuální podmínky pro živý režim, nastavení klíčů v chráněném prostředí a postup syntetické generálky jsou v [bezpečnostním auditu ACCURACY-08](PILOT-SECURITY.md).
