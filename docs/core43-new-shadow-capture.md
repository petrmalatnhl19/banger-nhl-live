# CORE 4.3 new-only shadow capture

This is a **preparation component**, not an enabled scheduled archive writer.

The upstream process must supply a JSON input containing `gameId`, `awayTeam`, `homeTeam`, `predictionAt`, `kickoffAt`, `baseline`, `observations`, `identities`, `gsaxRows`, and `gsaxFetchedAt`. Every source observation and identity must already be archived and time-stamped at or before the prediction. No historic replay is accepted.

Run from a trusted server-side job within **five minutes of the prediction timestamp**, before kickoff:

```sh
node scripts/core43_capture_new_shadow.cjs pregame-input.json core43-new-capture-UNIQUE-GAME-AND-TIME.json
```

The command writes a new file with exclusive-create mode (`wx`) and reports a SHA-256 checksum. Store the resulting JSON and checksum in a durable append-only external archive with independent creation timestamps; local files and GitHub Actions artifacts alone are not immutable evidence. Never overwrite or backdate an archive record. The output explicitly marks the shadow as uncalibrated and non-production.

**Not yet implemented:** automatic upstream data assembly, scheduled pregame capture, durable append-only upload, or end-to-end evaluation against verified finals. Do not claim live CORE 4.3 accuracy until those pieces exist and enough genuine paired games are collected.
