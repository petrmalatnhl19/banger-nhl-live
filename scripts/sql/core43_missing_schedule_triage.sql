-- CORE 4.3 missing-schedule triage, read-only.
-- Do not backfill predictions for finished games or fabricate historical timestamps.
WITH schedules AS (
 SELECT DISTINCT game_id FROM public.nhl_core43_schedule_snapshots
), missing AS (
 SELECT a.game_id,a.game_date,a.away_team,a.home_team,a.status,
 a.core41_predicted_at,a.core42_predicted_at
 FROM public.nhl_prediction_archive a
 LEFT JOIN schedules s ON s.game_id=a.game_id
 WHERE s.game_id IS NULL
)
SELECT CASE
 WHEN core41_predicted_at IS NULL AND core42_predicted_at IS NULL AND status='final'
 THEN 'final_without_core41_core42_no_prediction_backfill'
 WHEN core41_predicted_at IS NOT NULL OR core42_predicted_at IS NOT NULL
 THEN 'needs_independent_schedule_verification'
 ELSE 'needs_schedule_review'
 END AS disposition,
 count(*) AS games,
 min(game_date) AS earliest_game_date,
 max(game_date) AS latest_game_date
FROM missing GROUP BY 1 ORDER BY 1;
