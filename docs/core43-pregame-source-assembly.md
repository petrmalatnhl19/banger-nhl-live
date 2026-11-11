## CORE 4.3 source assembly (experimental)

`scripts/core43_pregame_source_assembly.cjs` accepts timestamped, already-archived schedule, frozen CORE 4.2 baseline, RotoWire observations, goalie identity mappings, and an **independently archived** GSAx season snapshot with `archiveId` and `fetchedAt`. It rejects future or ambiguous snapshots, stale capture windows, invalid baseline and conflicting schedules. The pure `prepareLiveShadowCapture` helper composes this with the new-only capture module.

**This is not a live scheduled job.** A trusted upstream source reader and real historical GSAx snapshot storage must be verified and wired first. The module never fetches fresh post-prediction GSAx and pretends it was archived earlier. It also does not persist output. Independent append-only storage, scheduler, and verification of actual end-to-end production readiness are pending.
