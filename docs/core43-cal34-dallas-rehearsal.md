# CORE43-CAL-34 — Zpětná generálka Dallas Stars

**Simulace vytvořená až po zápase.** Všechna predikční vstupní data CAL-14 jsou syntetická. Z oficiálních podkladů pochází ID utkání, týmy, plánovaný čas a doklad o skutečném začátku. Dočasné klíče v generálce spravoval jeden operátor.

## Utkání a zdroje

Florida Panthers (hosté) — Dallas Stars (domácí), ID `2026020327`, 15. listopadu 2026 v Dallasu. NHL boxscore uvádí plánovaný čas **19:00 CST** (16. listopadu 01:00 UTC, 02:00 SEČ). Finální Game Summary uvádí **19:08 CST** s přesností na minutu (01:08 UTC, 02:08 SEČ). Večerní interpretaci dvanáctihodinového zápisu potvrzuje oficiální předzápasový průvodce, který uvádí 19:00. Pro kryptografickou kontrolu se použila dřívější mez 01:00 UTC. [Game Summary](https://www.nhl.com/scores/htmlreports/20262027/GS020327.HTM) · [Boxscore](https://api-web.nhle.com/v1/gamecenter/2026020327/boxscore) · [Game Day Guide](https://www.nhl.com/stars/news/game-day-guide-florida-panthers-vs-dallas-stars-111526)

## Provedené kroky

| Krok | Výsledek |
| --- | --- |
| CAL-14 a CAL-13 | Čtyři varianty se syntetickými vstupy a skutečným ID. Podepsaný export, svědek a registr. Režim `simulation`. |
| CAL-32 | Ověření plánu a vytvoření dvou žádostí. Pouze hodiny přípravy byly simulovány. Pole uvnitř podepsaného testovacího balíčku jsou modelové předzápasové údaje. |
| CAL-16 | Dvě místní testovací TSA se samostatnými certifikačními řetězci vydaly tokeny ve skutečném aktuálním čase. Oba podpisy, řetězce a otisky prošly. Záměna nonce, změněný balíček a neplatný token byly odmítnuty pro obě autority. |
| CAL-33 | Stažené NHL podklady byly svázány s ID, týmy a časy. Podpis a provenience prošly s dočasným klíčem. |
| CAL-34 a CAL-30 | Archiv žádostí odpovídal dossier. Rozhodnutí `trusted: false`, důvod `cal30_timestamp_order`. Záměna žádosti, shodný provozovatel i přeznačení na historický režim byly odmítnuty. |
| CAL-35 | Převzetí doložené aktuálním časem bylo oprávněně odmítnuto po plánovaném začátku. |

Stejný simulátor se spouští offline nad archivem CAL-33. Soubor `review.json` musí obsahovat nezávisle zkontrolované `actualStartAt` a odůvodnění `clockCorroboration`. Spusť z kořene repozitáře s Node.js 22 a OpenSSL 3. Výstupní adresář musí být nový.

```sh
node scripts/core43_cal34_dallas_rehearsal.cjs sources.json review.json output
```

ZIP obsahuje samostatný návod pro ověřovatele, přesné bajty důkazů, veřejné certifikáty, podepsanou provenienci a `result.json` s otisky a důvody odmítnutí. Testovací soukromé klíče se nevydávají.

Před živým pilotem zbývá potvrdit oprávnění, cenu a provozní nezávislost GlobalSign a Sectigo, určit nezávislého ověřovatele NHL a správce archivu, připnout jejich veřejné klíče a vybrat budoucí utkání. Před ním musejí vzniknout obě skutečná razítka a nezávislé potvrzení převzetí archivu.
