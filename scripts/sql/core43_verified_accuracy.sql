-- CORE 4.3 verified forecast accuracy. Read-only, no backfill.
-- Outcome correctness excludes tied forecasts; actual NHL games have a winner.
-- Only compare models head-to-head on identical eligible games.
WITH schedule AS (
 SELECT game_id,min(kickoff_at) kickoff_at,
 min(away_team) away_team,min(home_team) home_team,
 count(DISTINCT (kickoff_at,away_team,home_team)) variants
 FROM public.nhl_core43_schedule_snapshots GROUP BY game_id
), verified AS (
 SELECT a.game_id,a.actual_away,a.actual_home,
 a.core41_away,a.core41_home,a.core42_away,a.core42_home,
 a.core41_predicted_at,a.core42_predicted_at,s.kickoff_at
 FROM public.nhl_prediction_archive a JOIN schedule s USING(game_id)
 WHERE a.status='final' AND a.actual_away IS NOT NULL AND a.actual_home IS NOT NULL
 AND a.actual_away<>a.actual_home
 AND s.variants=1 AND a.away_team=s.away_team AND a.home_team=s.home_team
), forecasts AS (
 SELECT game_id,'core41' model,actual_away,actual_home,core41_away predicted_away,
 core41_home predicted_home FROM verified
 WHERE core41_predicted_at IS NOT NULL AND core41_predicted_at<kickoff_at
 AND core41_away IS NOT NULL AND core41_home IS NOT NULL
 UNION ALL
 SELECT game_id,'core42',actual_away,actual_home,core42_away,core42_home
 FROM verified
 WHERE core42_predicted_at IS NOT NULL AND core42_predicted_at<kickoff_at
 AND core42_away IS NOT NULL AND core42_home IS NOT NULL
), metrics AS (
 SELECT *,
 CASE WHEN predicted_away=predicted_home THEN NULL
 ELSE (predicted_away>predicted_home)=(actual_away>actual_home) END AS winner_correct,
 (abs(predicted_away-actual_away)+abs(predicted_home-actual_home))/2.0 AS goal_mae,
 ((predicted_away-actual_away)^2+(predicted_home-actual_home)^2)/2.0 AS goal_mse
 FROM forecasts
), paired_games AS (
 SELECT game_id FROM metrics GROUP BY game_id HAVING count(DISTINCT model)=2
)
SELECT CASE WHEN p.game_id IS NULL THEN 'all_verified' ELSE 'paired_subset' END AS cohort,
 m.model,count(*) AS games,count(m.winner_correct) AS winner_calls,
 count(*) FILTER (WHERE m.winner_correct) AS correct_winners,
 round(avg(m.winner_correct::int)::numeric,4) AS winner_accuracy,
 round(avg(m.goal_mae)::numeric,4) AS goals_mae,
 round(sqrt(avg(m.goal_mse))::numeric,4) AS goals_rmse
FROM metrics m LEFT JOIN paired_games p USING(game_id)
GROUP BY GROUPING SETS ((m.model),(m.model,p.game_id IS NOT NULL))
HAVING GROUPING(p.game_id IS NOT NULL)=1 OR p.game_id IS NOT NULL
ORDER BY cohort,m.model;
