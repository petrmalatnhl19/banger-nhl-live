# LINEUPS-03 – ověřené formace a speciální týmy (datový kontrakt)

## Stav
Příprava bezpečného napojení; skutečné kombinace hráčů PP/PK nejsou dosud doloženy zápasovými daty. Nepoužívat projekční PP jako potvrzené zápasové jednotky.

## Existující zdroje a limity
- `gamecenter/{gameId}/boxscore`: hráči ve statistickém zápisu; neověřuje útoky, obranné dvojice ani PP1/PP2/PK1/PK2.
- `gamecenter/{gameId}/play-by-play`: události včetně vyloučení; bez současné přítomnosti všech hráčů na ledě nelze odvodit pětice.
- `lineups_verified_snapshot.json`: historické projekce; jen některé týmy mají `powerplay`; neprokazuje skutečně odehrané jednotky.

## Podmínky pro zobrazení jako skutečné sestavy
1. Identifikátor NHL zápasu, tým, časová razítka zdroje a původní URL či archivovaný artefakt.
2. Individuální intervaly střídání nebo jiný průkazný zdroj společného pobytu hráčů na ledě.
3. Stav hry a tresty v každém intervalu; vyloučení, vyrovnané počty, 4 na 4, 5 na 3, prázdná branka a odložené tresty musí být správně oddělené.
4. Odvození jednotek podle překryvu časů na ledě, nikoliv podle pořadí hráčů v boxscore. PP1/PP2 a PK1/PK2 jsou analyticky odvozené, ne automaticky oficiálně potvrzené.
5. Minimální práh společného času, počet střídání, pokrytí dat, výjimky a nejistota musí být viditelné a testované.
6. Chybějící či rozporné údaje => výslovné `Nedostupné`, nikoliv domyšlená sestava.

## Další implementace
Prověřit dostupnost a podmínky užití NHL shift-chart dat; připravit izolovaný parser s fixtures pro PP, PK, 5v5, 4v4, 5v3, empty net, souběh střídání a výpadky. Teprve potom připojit UI. Žádné změny CORE/Supabase.
