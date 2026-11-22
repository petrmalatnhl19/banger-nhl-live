# LINEUPS-03: audit skutečného zápasu 2026020335

Datum auditu: 2026-11-20. Zápas Edmonton Oilers @ Florida Panthers.

## Co lze doložit
- Nezávislý veřejný report https://hockeyweights.com/game/2026020335/ uvádí pozorované 5v5 formace z NHL shift charts, např. Edmonton Hyman–McDavid–Dach 11:03 a Ekholm–Bouchard 14:56. Jde o **externí benchmark**, nikoliv o výstup našeho parseru.
- NHL shiftcharts endpoint: `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId%3D2026020335`.
- V aktuálním běhu se nepodařilo získat přímou odpověď NHL API. Stav surových záznamů a naše shoda s benchmarkem jsou **NEOVĚŘENÉ**.

## Reprodukovatelná read-only kontrola
`node scripts/lineups-03-real-game-diagnostic.cjs 2026020335`

Výstup: počet řádků, hráčů, týmů, třetin, přijatých a odmítnutých střídání. Diagnostika **nevytváří ani nezveřejňuje potvrzené PP/PK jednotky**. Neobsahuje tajné klíče, nemění Supabase, neukládá data do produkce.

## Blokátory před reálným výpočtem
1. Ověřit skutečnou odpověď endpointu, její `total` a pokrytí obou týmů.
2. Porovnat surová střídání s oficiálním zápisem hráčů a brankářů a časem na ledě.
3. Získat nezávisle ověřené intervaly početního stavu; odložené tresty a empty-net situace nesmějí být odhadovány.
4. Zkontrolovat shodu odvozených 5v5 formací s externím benchmarkem; při nesouladu nevydávat výsledek za ověřený.
5. Prověřit podmínky použití zdrojů pro veřejnou aplikaci.

## Rozhodnutí
**NO-GO pro zobrazování skutečných PP/PK sestav** do splnění bodů 1–5. Projekce zůstávají oddělené.
