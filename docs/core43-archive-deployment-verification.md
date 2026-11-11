# CORE 4.3 archive deployment verification

On 2026-11-11, the dedicated experimental Supabase table `public.nhl_core43_shadow_capture_archive` was created and checked: RLS enabled, one update/delete rejection trigger, no anon SELECT grant, no authenticated INSERT grant, zero archived rows. The repository now includes a read-only archive verifier and regression tests.

The automatic monitor is still read-only; no scheduled capture writer is enabled. A verified GitHub scheduled workflow execution and a real prospective capture with independent timestamp evidence are prerequisites to enabling the server-side writer. Do not reconstruct or backfill a frozen prediction using later data.
