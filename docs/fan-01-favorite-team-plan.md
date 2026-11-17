# FAN-01 – Oblíbený tým: audit a implementační plán

## Ověřený stav (2026-11-17)
- Aplikace je statický web na GitHub Pages, hlavní UI je v `index.html` (cca 559 kB, 4827 řádků).
- CSS je převážně inline; existuje `styles/ux-01-compact-games.css`.
- Základní paleta používá proměnné `--cyan`, `--ink`, `--muted`, `--panel` a řadu pozdějších stylových přepisů.
- V `index.html` jsou funkce `renderStats`, `renderStandings`, `renderNewsPreview` a kód pro zprávy `nhl_news.json`.
- `localStorage` se již používá pro predikční tracker; nové nastavení musí mít samostatný klíč.
- README výslovně požaduje malé změny, regresní testy a neměnit CORE.

## Implementační kroky
1. Zmapovat DOM a datové identifikátory týmů v zápasech, statistikách, tabulkách a zprávách.
2. Přidat izolovaný modul `favorite-team.js` s validovaným výběrem ze všech 32 klubů a verzovaným klíčem `banger-favorite-team-v1`.
3. Přidat přístupné nastavení „Můj tým“, včetně volby „Bez týmu“ a resetu.
4. Definovat CSS tokeny pro týmové akcenty; zachovat tmavý základ, kontrast a kompaktní mobilní layout.
5. Zvýraznit pouze odpovídající týmové záznamy v zápasech, statistikách, tabulkách a novinkách. Nepřepisovat pořadí ani datové hodnoty.
6. Testovat první návštěvu, uložení, obnovení, změnu týmu, neplatné hodnoty, 32 týmů a mobilní šířky 360/390/430 px.

## Bezpečnost a souběžný vývoj
- Žádné změny Supabase, produkčního CORE, predikcí nebo existujících PR #230/#274.
- Žádné slučování ani nasazení bez ověření.
- Před úpravou `index.html` zkontrolovat aktuální `main` a minimalizovat konflikty.

## Stav
Audit struktury dokončen. Implementace a regresní testy zatím neprovedeny.
