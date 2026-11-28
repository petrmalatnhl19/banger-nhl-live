# CAL-28I — mandatory archive evidence for CAL-24

All original CAL-24, CAL-26 and CAL-28 preflight tests have been migrated to a shared synthetic RFC3161 signed archive fixture, retaining approval, replay, pre-/post-rename interruption, corrupt/symlinked pin, orphaned temporary file and stale lock cases. CAL-24 `advancePin` now rejects missing `hooks.archiveRoot` even for direct JavaScript callers and always invokes `verifyTransferEvidence` while holding the writer lock. An explicit bypass regression test was added.

**Scope:** offline synthetic evidence only. This does not establish independence of a real TSA, archive immutability against concurrent adversaries, authentic operator approval, verified official puck drop, or real-data go-live readiness. Keep Draft PR #230 unmerged; production CORE 4.2 unchanged; no Supabase writes.
