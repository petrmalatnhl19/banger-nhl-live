# CORE 4.3 read-only live source reader

Server-side diagnostic command (requires repository/server secrets, never browser credentials):

```sh
node scripts/core43_live_shadow_source_reader.cjs GAME_ID AWAY_CODE HOME_CODE PREDICTION_ASOF_ISO
```

The reader performs GET requests against the existing Supabase prediction archive, schedule snapshots, RotoWire observations, goalie identity map, and archived goalie GSAx snapshots. It passes them through the strict as-of assembly and experimental capture checks. A rejected result is expected when no valid pregame snapshot or matching projected goalies exist. The input timestamp must be the real live prediction time; do not supply a backdated timestamp. No database writes, migrations, scheduler, or durable append-only capture storage are included in this PR.

**Important:** A returned `captured:true` is an in-memory candidate, not proof of a durably archived pregame forecast. Automatic collection and independent storage must be implemented and tested separately before any accuracy claims.
