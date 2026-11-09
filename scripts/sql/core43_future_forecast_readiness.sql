-- CORE 4.3: read-only future game forecast readiness.
-- Never infers a new prediction or modifies frozen archive values.
WITH schedule_versions AS (
 SELECT game_id,count(*) AS snapshots,
 count(DISTINCT (kickoff_at,away_team,home_team)) AS versions,
 min(kickoff_at) AS kickoff_at,
 min(away_team) AS away_team,min(home_team) AS home_team
 FROM public.nhl_core43_schedule_snapshots
 GROUP BY game_id
), future AS (
 SELECT s.*,a.game_id IS NOT NULL AS archived,
 a.away_team AS archive_away,a.home_team AS archive_home,
 a.core41_predicted_at,a.core41_away,a.core41_home,a.core41_factors,
 a.core42_predicted_at,a.core42_away,a.core42_home,a.core42_factors
 FROM schedule_versions s LEFT JOIN public.nhl_prediction_archive a USING(game_id)
 WHERE s.kickoff_at>now()
), status AS (
 SELECT game_id,kickoff_at,
 CASE
 WHEN versions<>1 THEN 'blocked_schedule_conflict'
 WHEN NOT archived THEN 'awaiting_production_forecast'
 WHEN archive_away IS DISTINCT FROM away_team OR archive_home IS DISTINCT FROM home_team THEN 'blocked_team_mismatch'
 WHEN core41_predicted_at IS NULL THEN 'awaiting_core41'
 WHEN core41_predicted_at>=kickoff_at THEN 'blocked_core41_not_pregame'
 WHEN core41_away IS NULL OR core41_home IS NULL OR core41_factors IS NULL THEN 'blocked_incomplete_core41'
 ELSE 'frozen_core41_available' END AS core41_state,
 CASE
 WHEN versions<>1 THEN 'blocked_schedule_conflict'
 WHEN NOT archived THEN 'awaiting_production_forecast'
 WHEN archive_away IS DISTINCT FROM away_team OR archive_home IS DISTINCT FROM home_team THEN 'blocked_team_mismatch'
 WHEN core42_predicted_at IS NULL THEN 'awaiting_core42'
 WHEN core42_predicted_at>=kickoff_at THEN 'blocked_core42_not_pregame'
 WHEN core42_away IS NULL OR core42_home IS NULL OR core42_factors IS NULL THEN 'blocked_incomplete_core42'
 ELSE 'frozen_core42_available' END AS core42_state
 FROM future
)
SELECT core41_state,core42_state,count(*) AS games,min(kickoff_at) AS first_kickoff
FROM status GROUP BY core41_state,core42_state ORDER BY core41_state,core42_state;
