# CORE43-CAL-38 — Experimentální výpočet a porovnání offline

Kandidát je Edmonton Oilers @ Florida Panthers, NHL Game ID 2026020335. Plánovaný začátek je 18. listopadu 2026 v 01:00 SEČ. Okno CAL-07 je 17. listopadu 23:45 až 18. listopadu 00:15 SEČ. Před sběrem ověř aktuální rozpis podle [CAL-37](core43-cal37-edmonton-florida-pilot.md).

## Vstupy a připravenost

Veřejný rozpis potvrzuje plánovanou identitu a čas. Veřejná projekce sestav sama neposkytuje archivovaný CORE 4.2 ani časově uzavřený snímek GSAx. Pro tento zápas nemáme doložený schválený export. [CAL-06](core43-cal06-readonly-readiness-audit.md) blokuje stávající návrh živé čtecí role. Nejkratší cesta je přivést jednorázový, schválený export CAL-07 mimo GitHub Actions. Bez něj výpočet ve skutečném režimu zastav.

- Jeden konzistentní export musí obsahovat rozpis, původní archivovaný CORE 4.2 pro stejný zápas, pozorování brankářů obou týmů, jejich mapování na NHL ID a odpovídající archivní GSAx. Přesný rozsah sloupců a časy jsou v [CAL-07](core43-cal07-signed-pregame-export.md).
- Exportér musí doložit skutečný okamžik čtení a původ každého vstupu. Podepsaný export ověřujeme proti dříve schválenému klíči, záznamy přijaté až po okamžiku snímku se odmítají. Podpis a stáří exportu samy neprokazují, že exportér své časy a původ uvedl správně. Výsledky NHL do předzápasového výpočtu nevstupují.
- Výpočet zachovává varianty s koeficienty 0, 0.005, 0.02 a 0.03, očekávané góly pro oba týmy, základ CORE 4.2, použité brankáře, archivní GSAx, identitu zdrojového snímku a časy. Nulový koeficient reprodukuje základ po zaokrouhlení. Výstup je experimentální a vždy má hodnotu trusted: false.

## Ruční export

Potřebuješ Node.js 22, Git a čistý checkout přesného commitu CAL-38. Vstupy a výstupy ulož mimo checkout do soukromého adresáře. Soubory neposílej do GitHubu ani do CI. Profil získej odděleně od balíčku a ověř jeho klíč dříve, než export přijmeš. Profil JSON má pole mode (experimental pro schválený skutečný zdroj, simulation pro testovací zdroj), source, keyId, publicKeyPem a match. Pro tento zápas je match:

    {"gameId":"2026020335","awayTeam":"EDM","homeTeam":"FLA","kickoffAt":"2026-11-18T00:00:00.000Z"}

    umask 077
    node scripts/core43_cal38_experimental_capture.cjs capture \
      "$PRIVATE_CAL38/export.json" "$PRIVATE_CAL38/export.sig" "$PRIVATE_CAL38/profile.json" \
      "$PRIVATE_CAL38/prediction.json"

Příkaz používá aktuální čas stroje a odmítá vstupy mimo předzápasové okno, podvržené podpisy a odlišný zápas. Při úspěchu zapíše soubor bez možnosti přepsat existující cestu a vrátí SHA-256 přesných archivních bajtů. Ulož otisk odděleně v okamžiku vytvoření. V archivu jsou původní podepsané vstupy, jejich otisk, čas vytvoření, revize Git a otisky variant. Archiv přesuň do schváleného neměnného úložiště, pokud je k dispozici. Samotný lokální zápis neposkytuje nezávislý důkaz času ani trvalou neměnnost souboru. Pro experimentální výpočet se GlobalSign nevyžaduje.

## Po zápase

Z povoleného zdroje získej originální finální NHL boxscore. Porovnání nejprve ověří předem uložený otisk, stejnou verzi kódu a reprodukovatelnost výpočtu z původního podpisu. Až potom k očekávaným gólům připojí skutečné skóre, vítěze a údaj o konci v základní době, prodloužení nebo po nájezdech. Výsledek má trusted: false. Dokud chybí nezávislé časové důkazy, do historického vzorku CAL-11 jej nezařazuj.

    node scripts/core43_cal38_experimental_capture.cjs compare \
      "$PRIVATE_CAL38/prediction.json" "$CAPTURE_SHA256" "$PRIVATE_CAL38/profile.json" \
      "$PRIVATE_CAL38/boxscore.json"

[NHL boxscore](https://api-web.nhle.com/v1/gamecenter/2026020335/boxscore) · [CAL-11](core43-cal11-offline-accuracy.md)

## Návrh pravděpodobnosti vítězství

Jako samostatné rozšíření nejprve odhadni tři pravděpodobnosti po 60 minutách. Při remíze použij oddělený model pro výhru v prodloužení, soupeřovu výhru v prodloužení a přechod do nájezdů. V nájezdech použij zvláštní model pravděpodobnosti domácí výhry. Celková pravděpodobnost je P(výhra doma v 60 min) + P(remíza po 60 min) × [P(výhra doma v OT | remíza) + P(nájezdy | remíza) × P(výhra doma v nájezdech | nájezdy)]. Kalibraci a backtest dělej chronologicky na archivovaných předzápasových vstupech s oddělenou validační sadou. Porovnej Brier score a log loss s jednoduchým referenčním modelem. Teprve verzovaný a kalibrovaný výstup ukládej jako home_win_including_ot_so.

## Ověření

Příkaz pro nové regrese v izolovaném checkoutu:

    node --test scripts/test_core43_cal38_experimental_capture.cjs

Testy používají syntetické podepsané exporty. Ověřují úplnost čtyř variant, přesnou reprodukci, odmítnutí změněného archivu, pozdních vstupů, neplatného podpisu a jiného či nedohraného zápasu.
