# CORE 4.3 scheduled archive readiness gate

The existing scheduled monitor runs every 30 minutes, but a configured schedule is not evidence that it executed. The GitHub connector currently exposes pull-request workflow runs only, so scheduled execution has **not been independently verified**.

This change makes missing Supabase secrets a **failing job**, not a green skipped job. It also checks that the newly deployed experimental archive is reachable through the server-side read-only REST API before calculating prospective readiness. No writes are enabled.

Next deployment gate: inspect the first actual scheduled run in GitHub Actions, confirm the archive verification step and monitor succeeded, and inspect the generated readiness artifact. If any game is ready, wire an explicitly gated prospective writer in a separate PR and test a real pregame capture. Never claim archival or model accuracy from readiness alone.
