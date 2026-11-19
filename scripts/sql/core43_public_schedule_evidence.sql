-- Deploy separately via reviewed Supabase SQL editor / migration.
-- Minimal read-only public schedule evidence for verified accuracy.
-- The underlying schedule snapshot table remains RLS-protected and is NOT granted to anon.
-- A definer view exposes only game/team/kickoff combinations; duplicates are collapsed.
CREATE OR REPLACE VIEW public.nhl_core43_public_schedule_evidence
WITH (security_barrier = true)
AS
SELECT DISTINCT game_id, kickoff_at, away_team, home_team
FROM public.nhl_core43_schedule_snapshots
WHERE game_id IS NOT NULL AND kickoff_at IS NOT NULL
  AND away_team IS NOT NULL AND home_team IS NOT NULL;

REVOKE ALL ON public.nhl_core43_public_schedule_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.nhl_core43_public_schedule_evidence TO anon, authenticated;
-- No INSERT/UPDATE/DELETE privileges, no service role key in the browser.
