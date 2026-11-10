# CORE 4.3 — audit skutečného propojení (2026-11-10)

## Ověřené zjištění z main
- `index.html` nenačítá `core43-inputs.js`, `core43-gsax-bridge.js` ani `core43-starter-gate.js`; globální API `BangerCore43Inputs`, `BangerCore43GSAxBridge` a `BangerCore43StarterGate` nejsou v `index.html` použita.
- `index.html` načítá `scripts/core43_verified_dashboard.js`, což je **dashboard**, nikoliv důkaz nasazení CORE 4.3 do výpočtu skóre.
- `index.html` čte z `nhl_prediction_archive` mimo jiné `core41_*` a `core42_*` sloupce. Nenalezeno čtení `core43_*` jako produkčního výpočtu v tomto souboru.
- `core43-inputs.js` poskytuje experimentální fatigue/GSAx/absence hodnoty a označuje `production:false`.
- `core43-gsax-bridge.js` validuje pregame MoneyPuck snapshot; sám výsledek nepublikuje ani nemění produkční predikci.
- `core43-starter-gate.js` kontroluje explicitní potvrzení před predikcí; sám nic nepočítá ani neukládá.
- `docs/core43-production-collector-map.md` uvádí produkční CORE 4.1/4.2 a CORE 4.3 sensitivity jako hypotetický model. Dokument je z 2026-11-09 a stav nasazené Edge Function je třeba před jakýmkoliv zásahem znovu ověřit.

## Závěr
CORE 4.3 má dílčí výpočetní a validační moduly a běžící historický audit, ale **není doloženo, že je napojený do produkčního predikčního výpočtu**. Nepřisuzovat mu vliv na současné skóre ani deklarovat kalibraci.

## Bezpečný plán zapojení
1. Přečíst skutečný zdroj a verzi nasazené Supabase Edge Function `nhl-prediction-collect` a přesně určit místo, kde vznikají `core41`/`core42` predikce.
2. Zmapovat datové kontrakty a dostupnost skutečně časově zmrazených vstupů GSAx, únavy, absencí a projektovaných brankářů. Chybějící vstup je `null`, nikoliv nula.
3. Připravit samostatný read-only end-to-end test: pro jeden archivovaný zápas vykázat vstupy, zdroje, časové razítko, status ověření a hypotetický CORE 4.3 výstup. Porovnat s archivovanými CORE 4.1/4.2 bez přepisu.
4. Až po ověření vytvořit samostatný server-side, idempotentní výpočet revize s časem před začátkem zápasu a souběžnými testy; nasazení vyžaduje samostatné schválení.
5. V UI zobrazovat CORE 4.3 pouze jako experimentální diagnostiku, dokud nemá ověřené produkční podklady a kalibraci.

## Zákazy
- Nepřepisovat archivované predikce ani nevyrábět historické timestampy.
- Nepovažovat projekci brankáře za potvrzený start.
- Nezobrazovat neověřenou přesnost nebo pravděpodobnost jako produkční metriku.
- Nevystavovat Supabase service-role klíč do prohlížeče.
