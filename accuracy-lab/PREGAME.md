# CORE-ACCURACY-03 – audit předzápasového sběru

Laboratoř pokračuje v [Draft PR #258](https://github.com/petrmalatnhl19/banger-nhl-live/pull/258) od `ae4b56e0f4ae8221eb8563f93ee4c61a4b584d13`. Obě výchozí kontroly prošly. Nový sběrač spouští operátor lokálně. Kód volá veřejné zdroje metodou GET a ukládá nové lokální soubory. Zachovává podpisový a časový kontrakt etapy 02 i oddělené hodnocení původního vzorku. [Etapa 01](AUDIT.md) · [Etapa 02](REFERENCE.md)

## Dostupné zdroje a časová evidence

| Zdroj | Exportovaný podklad | Podmínky pro snímek |
| --- | --- | --- |
| NHL Score `/v1/score/{date}` | ID, týmy, zápasový den, sezona, plán a stav utkání | Shodná identita, základní část, platný plán a stav FUT/PRE. |
| NHL Standings `/v1/standings/now` | Odehrané zápasy, góly pro a proti na zápas | Přesměrování je povoleno jen na datovanou tabulku stejného hostitele NHL. `standingsDateTimeUtc` je údaj o sestavení dat a musí být nejpozději v okamžiku stažení. |
| NHL Club Schedule `/v1/club-schedule-season/{team}/{season}` | Rozestup plánovaných začátků od posledního dohraného zápasu obou týmů a příznak zápasů ve dvou navazujících dnech | Oba rozpisy se musí shodovat s identitou a plánem cílového utkání. Předchozí zápas musí být dohraný. Hodiny měří rozestup plánovaných začátků, nikoli přesný počet hodin od závěrečné sirény. |
| BANGER `rotowire_goalies.json` na veřejném `main` | Dva brankáři se stavem očekáván/potvrzen | Vyžaduje NHL Game ID, datum, tým, soupeře, stranu, číselné ID brankáře a čas aktualizace zrcadla. Rozpory vyřazují zdroj. Aktualizace zrcadla označuje čas zpracování, zatímco prvotní zveřejnění u poskytovatele zůstává nedoloženo. |
| BANGER `lineups.json` na veřejném `main` | Surová diagnostika sestav, uváděných zranění a vyřazení | Aktuální zrcadlo nedokládá konzistentně NHL ID zápasu a hráčů ani nezávislý čas jednotlivých položek. Nevytváří automaticky normalizovanou sestavu nebo seznam absencí. |
| Domácí výhoda | Chybí automatický zdroj verzované hodnoty odpovídající modelu | Doloží ji až konkrétní verze modelu a její připnutá konfigurace. |

Každý úspěšný export ukládá požadované i výsledné URL, začátek požadavku, dokončení stažení, bajty odpovědi, SHA-256 a obsahovou verzi. ETag a Last-Modified se uchovají jako HTTP metadata. `dataPublishedAt` je u těchto zdrojů prázdný. Aktuální API, HTTP hlavička nebo zrcadlo neprokazují historický okamžik prvního zveřejnění. Nezávisle dosvědčené stažení může doložit dostupnost nejpozději v tom okamžiku. Zdrojové otisky a odkaz na svědecký záznam jsou pak součástí podepsaného manifestu. Sběr po T−60, pozdní údaje, změněné otisky a přeznačený diagnostický odběr nevytvoří schválený referenční snímek.

## Ruční pilot

Termíny ověřeny 16. listopadu 2026 z NHL Score. U příkazů použij zápasový den NHL. V tabulce jsou místní časy v Česku (SEČ). Před odběrem znovu načti plán, protože NHL může začátek změnit.

| Datum NHL | Zápas | NHL Game ID | Okno pro ruční odběr v SEČ | Plán v SEČ |
| --- | --- | --- | --- | --- |
| 17. 11. | Los Angeles – Boston | 2026020333 | 17. 11. 23:45 až 18. 11. 00:00 | 18. 11. 01:00 |
| 18. 11. | Boston – Detroit | 2026020344 | 19. 11. 00:15–00:30 | 19. 11. 01:30 |
| 19. 11. | Los Angeles – Toronto | 2026020347 | 19. 11. 23:45 až 20. 11. 00:00 | 20. 11. 01:00 |

```sh
node accuracy-lab/pregame.cjs discover 2026-11-17 2026-11-18 2026-11-19
node accuracy-lab/pregame.cjs probe 2026-11-17 2026020333 PROBE.json
node accuracy-lab/pregame.cjs capture 2026-11-17 2026020333 CAPTURE.json
node accuracy-lab/snapshot.cjs digest CAPTURE.json
node accuracy-lab/pregame.cjs prepare CAPTURE.json REVIEW.json MANIFEST.json
node accuracy-lab/snapshot.cjs freeze ENVELOPE.json TRUST.json SNAPSHOT.json
node accuracy-lab/pregame.cjs status TRUST.json STATUS.json CAPTURE.json SNAPSHOT.json
```

`probe` lze spustit před otevřením okna. Výsledek je diagnostický. `capture` se spouští v posledních 15 minutách před T−60 a `prepare` musí doběhnout do časové hranice. Diagnostiku bez podepsaného snímku lze zobrazit příkazem `node accuracy-lab/pregame.cjs status - STATUS.json PROBE.json`. Soubor STATUS.json otevři v existujícím [dashboardu](index.html). Pro více zápasů přidej jejich soubory jako další argumenty. Páry s předzápasově potvrzenými výstupy se hodnotí stávajícím evaluátorem, až jsou k dispozici výsledky. Předzápasová obrazovka sama žádnou predikci nevytváří.

### Nezávislá kontrola

1. Před oknem připrav pozorovatele, hodiny nezávislé na počítači sběru a připnutý veřejný klíč ve formátu TRUST z etapy 02. Při živém odběru pozorovatel samostatně ověří rozpis, zdrojové URL, rozsah časového pokrytí a soulad otisků s bajty, které viděl před T−60. Připrav záznam pozorování s časovým dokladem a soupisem potvrzených podkladů.
2. `REVIEW.json` obsahuje `captureSha256` a `inputs`. Pro schválený vstup je položka například `"schedule": {"method":"live_retrieval_witness","dataThrough":"…ISO čas…","evidence":"urn:…nezavisly-zaznam…"}`. Čas `dataThrough` označuje doloženou horní mez pokrytí dat. Pokud ji pozorovatel nedokáže stanovit, položku vynechá. `prepare` připraví nepodepsaný manifest. `availableAt` rysu z odběru odpovídá poslednímu dosvědčenému stažení jeho zdrojů.
3. Nezávisle doložený doplněk lze přidat jako běžné pozorování etapy 02, ještě před podpisem. Při předání surového odběru i podepsaného manifestu ověřovatel znovu odvodí automatické položky z původních bajtů. Chybějící položky zůstanou viditelné. K ověření ručního doplňku slouží uchovaný zdroj a doklad pozorovatele.
4. Pozorovatel vytvoří `ENVELOPE.json` podpisem celého manifestu a svého potvrzení podle etapy 02 před T−60. Uchová podpis i nezávislý doklad jeho času. Samotný podpis dosvědčuje obsah výpovědi, zatímco důkaz skutečného času zajišťuje nezávislý záznam. [Formát obálky a příkazy pro podpis](REFERENCE.md)

## Výsledek zkoušky a reprodukovatelnost CORE

Dne 16. 11. byly provedeny tři skutečné diagnostické odběry mimo okno T−60. U všech tří se podařilo stáhnout všech šest odpovědí a sestavit kandidáty rozpisu, týmových statistik a brankářů. Kandidát odpočinku byl dostupný jen pro Los Angeles – Boston. U dalších dvou utkání nebyly oba bezprostředně předcházející zápasy v okamžiku odběru dohrané. Čas prvního zveřejnění dat ani nezávislé potvrzení nebyly v této zkoušce doloženy. Výsledek je **0 úplných snímků T−60, 3 neúplné diagnostické záznamy a 0 skutečně párových predikcí**.

| Model | Přesná překážka k reprodukci |
| --- | --- |
| CORE 4.0 | Repozitář umí zkontrolovat vážený součet již archivovaných komponent. K reprodukci z nového snímku chybí připnutý výpočet xG4, brankářské CORE 3.2, speciálních týmů CORE 3.3 a formy CORE 3.1 včetně předzápasových dat a verzí. NHL Standings poskytuje jen základní gólové statistiky. |
| CORE 4.1 | Navíc chybí přesný verzovaný postup kvality a fallbacků, který rozhoduje, zda se vstup CORE 3.2 použije a jak se přepočítají váhy. Pravé předzápasové vzorky střel a brankářských údajů pro tento krok samotné zrcadlo nedodá. |
| CORE 4.2 | Chybí připnutý zdroj pozdního serverového sběrače, jeho mapování identity, ověření čerstvosti a verzovaný výpočet z obou brankářských vzorků a týmové složky. Starší audit popisuje chování serveru. Lokální laboratoř znovu nepoužívá živý produkční výpočet. |
| CORE 4.3 | Existující funkce GSAx je experimentální citlivost nad zmrazenou 4.1. Vyžaduje už vytvořený baseline a časově doložený GSAx obou stejných brankářů. Výstup patří do simulací, takže se nepočítá jako pravý pár. |

[Audit serverových vzorců](../PREDICTION_INPUT_AUDIT_2026-11-07.md) · [Mapa produkčního sběrače](../docs/core43-production-collector-map.md) · [Existující výpočet citlivosti 4.3](../scripts/core43_gsax_sensitivity.cjs)

Pro **CORE-ACCURACY-04** je prvním cílem dokončit jeden nezávisle potvrzený odběr v okně T−60. Dořešit je potřeba zdroj sestav a absencí s NHL ID, časem a vazbou na zápas. Současně připni schválenou verzi výpočetního kódu alespoň dvou CORE a ověř jejich čistý offline vstup proti archivním kontrolním vzorkům. První skutečný pár lze vykázat, až oba modely doloží stejný podepsaný manifest, verzi, cíl a předzápasový čas výstupu.
