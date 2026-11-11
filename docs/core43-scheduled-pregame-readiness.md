# CORE 4.3 scheduled pregame readiness

The workflow `core43-pregame-readiness.yml` checks every 30 minutes (GitHub schedules may be delayed). It reads the existing Supabase schedules, archived CORE 4.2 baseline, RotoWire observations and identity map, and archived goalie GSAx snapshots. It checks games starting in the next 180 minutes and reports how many could form a prospective experimental candidate **at run time**.

This is deliberately **read-only**. It does not store a frozen prediction and does not write to Supabase. The GitHub artifact is temporary diagnostic evidence, not an append-only independent forecast archive. Do not count these diagnostics as independently frozen forecasts or claim accuracy from them. The next milestone is a dedicated, server-time-stamped append-only archive with safe duplicate handling and verified end-to-end capture.
