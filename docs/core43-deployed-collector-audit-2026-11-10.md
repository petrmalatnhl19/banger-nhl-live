# CORE 4.3 – ověření nasazeného produkčního collector systému (2026-11-10)

## Zdroj a ověření
- Supabase projekt: `xxwqeiuyislnoxsmjuul`.
- Přímo načtený nasazený Edge Function `nhl-prediction-collect`: **ACTIVE v26**, SHA-256 `aad6123716126e4ab7f7934daec6aa4fd9dae446cd08038ac2d5174d3c2bd42b`.
- Produkční funkce čte NHL schedule, standings, historickou formu, RotoWire goalie feed a MoneyPuck team data. Pro zápasy FUT/PRE před startem zapisuje predikční archiv, CORE 4.1 a CORE 4.2 podle vlastních pregame kontrol.
- Při čtení nasazeného zdroje nebyla doložena produkční větev CORE 4.3 GSAx/fatigue/absences; samostatné experimentální moduly v GitHubu nejsou důkazem nasazení.
- **Žádné Edge Function deployment ani databázová změna neproběhla.**

## Read-only stav archivu
```sql
select
 count(*) as total,
 count(*) filter(where core41_away is not null and core41_home is not null) as core41,
 count(*) filter(where core42_away is not null and core42_home is not null) as core42,
 count(*) filter(where status='pending') as pending
from nhl_prediction_archive;
```
Výsledek při kontrole: `total=65`, `core41=51`, `core42=9`, `pending=30`. Počty jsou snapshot a mohou se měnit.

## Bezpečný další krok
1. Vytvořit read-only vstupní kontrakt nad existujícím archivem a pregame snapshoty: game ID, tým, kickoff, original predicted_at, frozen CORE 4.1/4.2 faktory, projected/confirmed goalie evidence, GSAx, schedule fatigue, absences.
2. Rozlišit chybějící a neověřené vstupy; nic nedoplňovat zpětně z pozdějšího zdroje.
3. Pro vybraný archivovaný zápas otestovat end-to-end sestavení diagnostického výstupu bez nového modelového skóre a bez zápisu.
4. Teprve potom vyhodnotit samostatný server-side CORE 4.3 výpočet a jeho ověřitelné předzápasové timestampy.

## Rizika
- Současná Edge Function je aktivní produkční komponenta; bez samostatného rollout testu ji nepřepisovat.
- RotoWire `projected` není `confirmed`; čas zachycení není čas původního publikování.
- MoneyPuck sezónní agregát stažený po začátku zápasu nesmí sloužit jako předzápasový snapshot.
- Žádné domnělé zlepšení přesnosti nebo kalibrovaná pravděpodobnost.
