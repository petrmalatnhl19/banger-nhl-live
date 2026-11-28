# CORE43-CAL-44 — Read-only audit CAL-07 export readiness, game 2026020335

Audit: 2026-11-17 ~12:40–12:45 UTC. Repo `petrmalatnhl19/banger-nhl-live`, Draft PR #230, výchozí HEAD `08547d9b56e3e975bd231b9d24dc0d3349715bab`. Pouze SELECT a čtení existující dokumentace; žádná aktivace ani export.

## Verdikt: NOT_READY — export není schválen

### 1. Produkční CORE 4.2
- `nhl_prediction_archive` game_id 2026020335, EDM/FLA, `status=pending`, `core42_away=3.38055896962006`, `core42_home=3.06434482648226`, `core42_predicted_at=2026-11-17T12:15:12.367Z`, verze `banger-core-v4.2-late-goalie`.
- `nhl_core43_schedule_snapshots`: kickoff `2026-11-18T00:00:00Z`, poslední snapshot `2026-11-17T09:36:43.582Z`. Predikce je časově před zápasem. Samotný SQL timestamp však nedokazuje kryptografickou neměnnost.
- `nhl_prediction_revisions` pro zápas: 0 řádků; `nhl_core43_shadow_capture_archive`: 0 řádků. Chybí samostatný podpisový/archivní důkaz pro tento konkrétní export.

### 2. Pět zdrojových tabulek CAL-07 (existence dat, nikoli finální konzistentní export)

| Zdroj | Zjištění |
| --- | --- |
| `nhl_prediction_archive` | 1 řádek pro game ID |
| `nhl_core43_schedule_snapshots` | 11 snapshotů pro game ID |
| `nhl_core43_rotowire_observations` | 296 pozorování pro game ID; nejnovější `2026-11-17T12:38:12.607039Z` |
| `nhl_core43_goalie_identity_map` | 22 historických záznamů pro IDs 8482221 a 8474593 |
| `nhl_core43_goalie_snapshots` | 22 historických GSAx záznamů pro tato IDs |

Počty jsou historické záznamy, nikoli důkaz aktuálnosti, jednoznačnosti či transakční konzistence exportu. Finální CAL-07 specifikace vyžaduje společné `asOf`, validaci všech zdrojů a podpis Ed25519; dokumentace CAL-41 uvádí, že schválenou omezenou čtecí roli CAL-06 nelze obejít.

### 3. Brankáři a GSAx
- Nejnovější RotoWire: EDM Devon Levi, FLA Jacob Markstrom, oba `projected`, nikoli `confirmed`.
- `core43_core42_comparison_readiness`: Levi ID 8482221, GSAx +2.6000/267 shots; Markstrom ID 8474593, GSAx +3.6800/264 shots; oba `not_confirmed`; GSAx `fetched_at=2026-11-17T09:26:35.129504Z`.
- `core43_goalie_experiment_inputs` však pro stejná IDs ukazuje GSAx +1.2100/248 shots a +1.4100/240 shots, oba `starter_not_confirmed`. Tyto hodnoty odpovídají staršímu snapshotu z `2026-11-14T09:11:38.26343Z`, nikoli nejnovějšímu 17. 11. **Riziko nekonzistentního výběru snapshotu**; bez objasnění nesmí vzniknout schválený export.
- `core43_confirmed_goalie_matchups`: `awaiting_confirmed_starters`, oba goalie ID/GSAx NULL.
- `core43_shadow_predictions_v1`: `ready_sides=0/2`, `core43_away/home=NULL`, `awaiting_verified_pregame_inputs`.

### 4. Oprávnění — metadata, nikoli end-to-end test exportu
- `pg_class`: RLS zapnuté na všech pěti zdrojových tabulkách.
- `information_schema.role_table_grants`: zdrojové tabulky schedule/RotoWire/identity/GSAx mají SELECT pro `postgres` a `service_role`, nikoli doložené SELECT pro `anon` či `authenticated`. Archiv predikcí má SELECT pro `anon`, `authenticated`, `postgres`, `service_role`.
- `pg_policies`: `nhl_prediction_archive` má `Read NHL archived predictions` pro `anon,authenticated`; ostatní čtyři zdroje nemají zjištěnou veřejnou SELECT politiku.
- Neověřena existence, nasazení ani end-to-end oprávnění schválené úzce omezené exportní role CAL-06. Žádné použití `service_role` jako obchvatu, žádné GRANT, změna RLS ani čtení tajných klíčů.

### 5. Exportní mechanismus — hranice ověření
- Z existující dokumentace CAL-41 až CAL-43 vyplývá zamýšlený CAL-07: konzistentní pětitabulkový read-only export, `asOf/issuedAt`, identita game/team, GSAx, Ed25519 podpis, omezená role, fail-closed.
- V tomto běhu nebyl nalezen ani spuštěn ověřený end-to-end export pro game ID; nebylo prokázáno funkční podepisování ani nezávislé časové potvrzení. GitHub search pokrývá default branch a dotazy `CAL-07`, `export`, `approved` nevrátily výsledky; to **neprokazuje absenci kódu na pracovní větvi**.
- Žádný export ani artefakt nebyl vytvořen. Stav zůstává `NOT_READY`.

## Bezpečný runbook pro T−75 až T−45 minut

**Okno:** 2026-11-17 22:45–23:15 UTC = 23:45–00:15 SEČ, kickoff 2026-11-18 00:00 UTC (01:00 SEČ).

1. Ověřit aktuální HEAD PR #230 a aktuální kickoff z oficiálního snapshotu. Při změně kickoffu přepočítat okno; nezachovávat staré časové předpoklady.
2. Pouze SELECT ověřit původní CORE 4.2, timestamp před kickoffem, verzi, hodnoty a původ; nikdy jej neregenerovat po zápase.
3. Ověřit obě `confirmed` RotoWire pozorování, přesné goalie IDs a čerstvost `source_snapshot_at` pro stejné game/team.
4. Ověřit GSAx z **jednoznačně zvoleného** předzápasového snapshotu `fetched_at <= asOf < kickoff_at`; odstranit nesoulad mezi experimentálním a porovnávacím pohledem pouze diagnostikou, nikoli ručním přepsáním dat.
5. Ověřit všech pět zdrojů vůči jedinému konzistentnímu `asOf` a pravidlům CAL-07. Záznamy s časem po `asOf` nepoužít.
6. Read-only ověřit úzká exportní oprávnění CAL-06 a existenci schváleného podepisovacího mechanismu; žádné zvyšování oprávnění, použití `service_role` jako náhrady nebo vystavení soukromého klíče.
7. Pouze pokud všechny podmínky projdou, předat k **samostatně schválenému** exportnímu běhu. Tento audit žádný export neautorizuje ani neaktivuje. Ověřit podpis, digest, issuedAt, game ID, snapshoty a časové razítko.
8. Pokud jediná podmínka chybí: `NOT_READY`, uvést konkrétní důvod, žádný backfill ani falešný předzápasový artefakt. Pokračovat dalším budoucím zápasem.

## Bezpečnostní potvrzení

Žádný zápis do Supabase, změna Edge Function, CRON, role, RLS, produkčního CORE 4.2, merge či deploy. Jediná zamýšlená změna v repozitáři je tento dokument v existujícím Draft PR #230.
