# CORE43-CAL-39 — Předzápasový export EDM @ FLA

Příprava k 16. listopadu 2026 pro utkání 2026020335. Počítá s plánovaným začátkem 18. listopadu v 01:00 SEČ a s oknem od 17. listopadu 23:45 do 18. listopadu 00:15 SEČ. Na začátku sběru ověř aktuální plán utkání schváleným způsobem podle [CAL-37](core43-cal37-edmonton-florida-pilot.md).

## Co je doložené

| Vstup | Stav pro toto utkání |
| --- | --- |
| Rozpis a týmy | Identita a plánovaný čas jsou doložené v CAL-37. V konzistentním exportu zatím chybí potvrzený archivní řádek rozpisu. |
| Základ CORE 4.2 | Tabulka již existuje. Audit CAL-11 popisuje starší zápasy. Jednoznačný původní řádek pro toto Game ID nebyl dodán ani ověřen. |
| Pozorování brankářů a jejich NHL ID | Repozitář má čtečku a párování pozorování. Pro EDM a FLA nebyla dodána odpovídající dvojice archivních pozorování a mapování. |
| Archivní GSAx | Schéma a výpočet existují. Způsobilý snímek s pokrytím obou identit, časem a původním SHA-256 nebyl pro tento zápas doložen. |
| Ostatní týmové statistiky | CAL-03/CAL-07 používá zmrazený základ CORE 4.2. Aktuální týmové statistiky z webu nejsou samostatným vstupem této verze a základ nenahradí. |

Nedoložené řádky nelze prohlásit za chybějící v databázi. CAL-39 žádnou živou čtečku nepoužil. [CAL-06](core43-cal06-readonly-readiness-audit.md) zaznamenal blokaci navržené role kvůli oprávněním PUBLIC ke schématu net. Stav oprávnění se u této etapy znovu živě neměřil. Starší CLI používá servisní klíč a jednotlivé GET dotazy. To nedokládá nejnižší nutná oprávnění ani jeden konzistentní snímek pro CAL-07.

## Jednorázová příprava a ruční předání

1. Vlastník dat poskytne hotový podepsaný CAL-07 export, nebo potvrdí již schválený omezený zdroj a exportéra. Nový nástroj umí podepsat připravený soubor offline. Přístup, čtení a provenienci musí doložit poskytovatel dat. Nepotřebujeme servisní klíč ani migraci.
2. V reálném okně poskytovatel pořídí jeden konzistentní snímek podle [projekcí CAL-07](core43-cal07-signed-pregame-export.md#producer-and-delivery). V čase asOf musí být doloženě dostupný každý použitý řádek. Vybere přesně jeden základ a rozpis pro Game ID 2026020335 a oba týmy. Zachová konkurenční pozorování a mapování nutná k detekci nejednoznačnosti. U GSAx vybere nejnovější jednoznačný způsobilý snímek před omezením na oba brankáře. Pokud v něm některý chybí nebo má méně než 30 střel proti, sběr zastaví.
3. Poskytovatel uloží soukromý kompaktní JSON se dvěma poli, asOf a tables. Časy porovná v původní přesnosti a do formátu CAL-07 je převede teprve po kontrole. Čas asOf je skutečný okamžik konzistentního čtení v UTC s milisekundami. Odložený nebo zpětně rekonstruovaný soubor se nepoužije. Dále připraví profil CAL-38 se schváleným veřejným klíčem a správným zápasem. Soukromý klíč Ed25519 ve formátu PEM drží jen exportér.
4. Následující ruční příkazy spusť pouze s pravými schválenými vstupy. Cesty jsou mimo čistý checkout, podepisuje exportér. Na straně příjemce se veřejný profil a SHA-256 ověřují odděleně vůči schválenému zdroji. Předání se dokončí, pouze když podpisový příkaz skončí s kódem nula.

       umask 077
       node scripts/core43_cal39_sign_snapshot.cjs \
         "$PRIVATE_CAL39/snapshot.json" "$PRIVATE_CAL39/profile.json" \
         "$PRIVATE_CAL39/signing.pem" "$PRIVATE_CAL39/signed"

       node scripts/core43_cal38_experimental_capture.cjs capture \
         "$PRIVATE_CAL39/signed/export.json" "$PRIVATE_CAL39/signed/export.sig" \
         "$PRIVATE_CAL39/profile.json" "$PRIVATE_CAL39/prediction.json"

Pokud je hotový schválený export již dodán, použij druhý příkaz přímo. CAL-39 zapíše originální JSON a samostatný binární podpis do nové složky a vrátí SHA-256. Ověří shodu klíčů, čas vydání, čas snímku, přesný zápas a dostupnost všech čtyř variant prostřednictvím CAL-07. CAL-38 při převzetí znovu ověří jejich obsah a svůj aktuální čas. Pětiminutová platnost běží od asOf. Zůstanou-li vstupy nebo oprávnění nedoložené do konce okna, tento zápas přeskoč. Výstup i případné pozápasové srovnání [CAL-38](core43-cal38-experimental-capture.md#po-zápase) zůstávají trusted: false bez nezávislých časových důkazů.

Testy CAL-39 používají pouze syntetické vstupy a dočasné klíče. Pokrývají přijetí exportu v CAL-38, odmítnutí pozdních či neúplných dat, záměny klíče a zápasu a ochranu souborů při opakovaném spuštění.
