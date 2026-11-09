-- CORE 4.3 read-only pregame time-integrity audit.
-- Safe to rerun; no writes or mutation. Missing schedules are UNKNOWN, never PASS.
WITH schedules AS (
 SELECT game_id, count(*) AS snapshot_count,
 count(DISTINCT (kickoff_at, away_team, home_team)) AS distinct_versions,
 min(kickoff_at) AS kickoff_at,
 min(away_team) AS away_team,
 min(home_team) AS home_team
 FROM public.nhl_core43_schedule_snapshots GROUP BY game_id
), joined AS (
 SELECT a.game_id,a.away_team,a.home_team,a.core41_predicted_at,a.core42_predicted_at,
 s.kickoff_at,s.snapshot_count,s.distinct_versions,
 (a.away_team=s.away_team AND a.home_team=s.home_team) AS teams_match
 FROM public.nhl_prediction_archive a LEFT JOIN schedules s USING (game_id)
), classified AS (
 SELECT *,
 CASE WHEN kickoff_at IS NULL THEN 'unknown_missing_schedule'
 WHEN distinct_versions<>1 THEN 'invalid_conflicting_schedule'
 WHEN teams_match IS DISTINCT FROM true THEN 'invalid_team_mismatch'
 WHEN core41_predicted_at IS NULL THEN 'not_recorded'
 WHEN core41_predicted_at>=kickoff_at THEN 'invalid_not_pregame'
 ELSE 'valid_pregame' END AS core41_status,
 CASE WHEN kickoff_at IS NULL THEN 'unknown_missing_schedule'
 WHEN distinct_versions<>1 THEN 'invalid_conflicting_schedule'
 WHEN teams_match IS DISTINCT FROM true THEN 'invalid_team_mismatch'
 WHEN core42_predicted_at IS NULL THEN 'not_recorded'
 WHEN core42_predicted_at>=kickoff_at THEN 'invalid_not_pregame'
 ELSE 'valid_pregame' END AS core42_status
 FROM joined
)
SELECT core41_status,core42_status,count(*) AS games
FROM classified GROUP BY core41_status,core42_status
ORDER BY core41_status,core42_status;
