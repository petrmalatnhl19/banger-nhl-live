# CORE 4.3 pilot readiness diagnostics

A manual pilot invoked too early now returns `diagnostics` with a detailed read-only breakdown: valid schedule, remaining minutes, CORE 4.2 baseline, observed goalie teams, goalie identity coverage, and archived GSAx coverage. A typical early run returns `outside_180_minute_capture_window` rather than an unexplained generic failure.

This does **not** relax the three-hour capture window or allow any write. The diagnostic identity and GSAx coverage checks are preliminary only; the actual capture still validates exact identities, provenance, and frozen timestamps. Keep `confirm_write=false` until an actual prospective capture is validated.
