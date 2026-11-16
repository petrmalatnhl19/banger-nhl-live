# CORE Accuracy Lab 01

Samostatná lokální laboratoř pro vyhodnocení předzápasových predikcí proti dokončeným utkáním NHL. Výstupem je jeden JSON s výsledky, predikcemi, auditními důvody, metrikami a seznamy spárovaných NHL Game ID.

## Spuštění

Vyžaduje Python 3.12 a Node.js 22 nebo novější. Příkazy se spouštějí z kořene repozitáře. Výstupní soubory mají mít nové názvy. Pro přeměření pilotu použij stejné datum, časovou hranici a počet zápasů.

```sh
python3 -B accuracy-lab/collect.py \
  --end 2026-11-15 --cutoff 2026-11-16T08:00:00Z --days 15 --count 100 \
  --output /tmp/core-accuracy-raw.json
node accuracy-lab/evaluate.cjs /tmp/core-accuracy-raw.json /tmp/core-accuracy-pilot.json
```

Otevři `accuracy-lab/index.html` v prohlížeči a vyber `core-accuracy-pilot.json`. Dashboard funguje z disku a při vykreslování používá pouze načtený report. Datum ve filtrech znamená zápasový den NHL. Časy v detailu se zobrazují v pásmu Europe/Prague. Z volby „Všechny modely“ je dostupné párové porovnání.

Pro offline ověření vyhodnocení uchovej surový JSON z konkrétního běhu. Nový výběr z veřejných zdrojů v budoucnu může vrátit opravené záznamy. Zdrojové adresy, čas stažení a SHA-256 zpracovaného NHL Game Summary jsou součástí výsledku. Archiv se čte omezenými GET dotazy přes přístup, který už používá produkční panel. Celý lokální tok běží bez privilegovaných klíčů. Schéma Supabase, sběr predikcí a produkční web tento adresář neimportují.

## Výběr a časová integrita

- Výběr se provádí podle času plánovaného začátku a NHL Game ID, bez přístupu k predikcím nebo k jejich přesnosti. Zahrnuje posledních nejvýše 100 zápasů základní části z pevného rozsahu. Nevalidní nebo dosud nedohrané položky se vykážou v auditu a jejich místo se nedoplňuje.
- Oficiální NHL Score a Boxscore se musí shodnout v ID, datu, čase, týmech, skóre a závěrečné fázi. U nájezdů je oficiální rozhodující gól součástí výsledku, zatímco metrika gólů ze hry ho vynechá.
- Archivní datum je UTC datum plánovaného začátku. NHL `gameDate` představuje zápasový den. Archivní datum, identita týmů, veřejná evidence rozpisu, plán v boxscore a plán ve faktorech predikce se ověřují podle příslušných konvencí.
- Čas predikce musí být přísně před dřívějším z plánovaného začátku a oficiálního začátku z Game Summary, zaokrouhleného dolů na minutu. Dvanáctihodinový údaj Game Summary se čte v časovém posunu haly. Musí odpovídat jedinému možnému času v toleranci tří hodin vůči plánu. Chybějící nebo rozporný začátek zavře časovou kontrolu. Konečné skóre a skuteční brankáři slouží pouze jako výsledky a kontext zápasu.
- Identické duplicity se zaznamenají a počítají jednou. Konflikt vyřadí celý klíč příslušného zdroje. Audit nese důvody vyřazení a upozornění podle modelu.
- U CORE 4.0 a 4.1 se ověří časy přijatých komponent, známé nominální váhy a shoda váženého součtu s archivem. Ověření sahá k archivovaným komponentám. Jejich původní surová data a proces výpočtu zůstávají mimo rozsah ověření.
- U CORE 4.2 se ověří čas uložení, dokumentované dvanáctihodinové okno a deklarované stáří brankářského feedu. Jednotlivé časy dostupnosti podkladů chybí. Tyto řádky jsou výslovně označeny jako archivované s neúplnou proveniencí vstupů a slouží k popisnému vyhodnocení archivovaných výstupů.
- Archivované, reprodukované a simulované záznamy mají samostatné přehledy. První etapa nepřijímá přeznačené reprodukce. Odložená reprodukce vyžaduje identifikovatelný výpočet, zmrazené zdrojové snímky a ověřitelnou časovou dostupnost. Simulace mají vlastní volitelný vstup `simulations` v surovém reportu. Položka uvádí `kind: "simulation"`, `gameId`, `model`, `asOf`, `goals: {away, home}`, a `inputs`. Každý známý čas po `asOf` nebo role jiná než `pregame` se odmítne. Volitelná `probability` vyžaduje `target: "final" | "regulation"` a úplné `values` pro domácí, hosty a u základní doby také remízu. Pilot žádný simulovaný výstup neobsahuje.

## Jak číst metriky

- Vítěz zápasu zahrnuje prodloužení i nájezdy. U archivovaných modelů slouží vyšší odhad gólů jako odvozený tip, rovnost znamená bez tipu. Pro základní dobu sledujeme domácí, hosty a remízu. Archivní gólový odhad bez deklarovaného výsledku po 60 minutách nemá úspěšnost pro tuto kategorii.
- MAE se počítá zvlášť pro hosty a domácí a jako průměr obou stran. Archiv nedeklaruje cíl predikovaného skóre, proto pilot používá jednotný analytický cíl „góly ze hry včetně prodloužení“. Metrika znamená vzdálenost od tohoto cíle.
- Binární Brier je standardní chyba pravděpodobnosti výhry domácích. Třívýsledkový Brier je součet čtvercových chyb všech tří možností. Log loss používá přirozený logaritmus a dolní mez pravděpodobnosti `1e-15`. Kalibrace výhry domácích používá pět pevných pásem. Pravděpodobnosti se z odhadu skóre nedopočítávají.
- Velikosti vzorku se uvádějí zvlášť pro skóre, tipy a pravděpodobnosti. Úspěšnost a kalibrační pásma mají popisný 95% Wilsonův interval. NHL zápasy sdílejí týmy a hrací dny, takže tyto intervaly nevyjadřují jistotu při závislosti pozorování.
- Párování vyžaduje stejný NHL Game ID a kategorii původu. Pro gólovou chybu má pár stejný cíl. Pro úspěšnost musí oba modely tipnout výsledek. Pro Brier a log loss musí oba dodat pravděpodobnost stejného výsledku. Report odděluje počet shodných zápasů, shodných časů a shodných doložených komponent v témže čase. Rozdíl času nebo nedoložené vstupy umožňují pouze popisný pohled na archiv.
- Vzorek je pilotní a v této etapě neprobíhalo ladění. Přesnost z tohoto období se při budoucím ladění nepoužije jako nezávislý validační výsledek. Pro potvrzující porovnání vymez samostatné nové období před sběrem.

## Testy

```sh
python3 -B -m unittest discover -s accuracy-lab -p test_collect.py
node --test accuracy-lab/engine.test.cjs
node --check accuracy-lab/dashboard.js
node --check accuracy-lab/evaluate.cjs
```

Detaily modelů a výsledek pilotu jsou v [auditním reportu](AUDIT.md).
