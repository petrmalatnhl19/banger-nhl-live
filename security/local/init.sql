-- SECURITY-09: synthetic schema only. NO production data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.nhl_core43_shadow_inputs (game_id bigint, side text, team_code text, goalie_name text, goalie_id text, prediction_at timestamptz, captured_at timestamptz DEFAULT now(), gsax numeric, shots_against integer, gsax_fetched_at timestamptz, starter_status text, starter_published_at timestamptz, starter_verified_at timestamptz, readiness text, UNIQUE(game_id,side));
CREATE TABLE public.nhl_prediction_archive (game_id bigint PRIMARY KEY, prediction numeric, core42_predicted_at timestamptz, status text, core42_goalie_review jsonb, game_date date, away_team text, home_team text, core42_away double precision, core42_home double precision, core42_factors jsonb, actual_away integer, actual_home integer, baseline_away double precision, baseline_home double precision, advanced_away double precision, advanced_home double precision, goalie32_away double precision, goalie32_home double precision, special33_away double precision, special33_home double precision, core40_away double precision, core40_home double precision, core41_away double precision, core41_home double precision);
CREATE TABLE public.nhl_core43_goalie_snapshots (id bigint, game_id bigint, goalie_id text, team_code text, situation text, fetched_at timestamptz, source_sha256 text, x_goals_against numeric(12,4), goals_against numeric(12,4), gsax numeric(12,4), shots_against integer, created_at timestamptz);
CREATE TABLE public.nhl_core43_starter_evidence (id bigint, game_id bigint, team_code text, goalie_id text, evidence_status text, source_name text, source_url text, source_published_at timestamptz, verified_at timestamptz, created_at timestamptz);
CREATE TABLE public.nhl_core43_schedule_snapshots (game_id bigint, kickoff_at timestamptz, away_team text, home_team text);
ALTER TABLE public.nhl_core43_shadow_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhl_prediction_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_read ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (true);
INSERT INTO public.nhl_core43_shadow_inputs (game_id,side,gsax,shots_against,readiness,goalie_id,gsax_fetched_at,prediction_at,starter_status) VALUES (1,'away',1.2,40,'ready','A',now()-interval '2 hours',now()-interval '1 hour','confirmed'),(1,'home',0.8,40,'ready','H',now()-interval '2 hours',now()-interval '1 hour','confirmed');
INSERT INTO public.nhl_prediction_archive (game_id,prediction,core42_predicted_at,status,core42_goalie_review,game_date,away_team,home_team,core42_away,core42_home,core42_factors) VALUES (1,3.4,now(),'pending',NULL,current_date,'DAL','BOS',2.7,2.4,'{"away_goalie":{"name":"Synthetic A","nhl_player_id":"A"},"home_goalie":{"name":"Synthetic H","nhl_player_id":"H"}}'::jsonb);
INSERT INTO public.nhl_core43_goalie_snapshots (game_id,goalie_id,team_code,situation,fetched_at,gsax,shots_against) VALUES (1,'A','DAL','all',now()-interval '2 hours',1.2,40),(1,'H','BOS','all',now()-interval '2 hours',0.8,40);
INSERT INTO public.nhl_core43_starter_evidence (game_id,team_code,goalie_id,evidence_status,source_published_at,verified_at) VALUES (1,'DAL','A','confirmed',now()-interval '2 hours',now()-interval '2 hours'),(1,'BOS','H','confirmed',now()-interval '2 hours',now()-interval '2 hours');
INSERT INTO public.nhl_core43_schedule_snapshots VALUES (1,now(),'DAL','BOS');
-- Production-equivalent SQL from read-only pg_get_viewdef inspection (SECURITY-11).
CREATE VIEW public.core43_shadow_predictions_v1 AS
WITH inputs AS (
         SELECT nhl_core43_shadow_inputs.game_id,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'away'::text) AS away_gsax_per100,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'home'::text) AS home_gsax_per100,
            count(*) FILTER (WHERE nhl_core43_shadow_inputs.readiness = 'ready'::text) AS ready_sides,
            count(*) AS total_sides
           FROM nhl_core43_shadow_inputs
          GROUP BY nhl_core43_shadow_inputs.game_id
        )
 SELECT a.game_id,
    a.game_date,
    a.away_team,
    a.home_team,
    a.status,
    a.core42_away,
    a.core42_home,
    i.away_gsax_per100,
    i.home_gsax_per100,
    i.ready_sides,
    i.total_sides,
        CASE
            WHEN i.ready_sides = 2 AND i.total_sides = 2 AND a.core42_away IS NOT NULL AND a.core42_home IS NOT NULL THEN round(GREATEST(0.4::double precision, LEAST(6.0::double precision, a.core42_away + GREATEST('-0.3'::numeric, LEAST(0.3, (i.away_gsax_per100 - i.home_gsax_per100) * 0.06))::double precision))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_away,
        CASE
            WHEN i.ready_sides = 2 AND i.total_sides = 2 AND a.core42_away IS NOT NULL AND a.core42_home IS NOT NULL THEN round(GREATEST(0.4::double precision, LEAST(6.0::double precision, a.core42_home + GREATEST('-0.3'::numeric, LEAST(0.3, (i.home_gsax_per100 - i.away_gsax_per100) * 0.06))::double precision))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_home,
        CASE
            WHEN i.ready_sides = 2 AND i.total_sides = 2 THEN 'experimental_ready'::text
            ELSE 'awaiting_verified_pregame_inputs'::text
        END AS experiment_status,
    'core43-shadow-gsax-v1-heuristic-unvalidated'::text AS model_version
   FROM nhl_prediction_archive a
     JOIN inputs i USING (game_id)
  WHERE a.core42_predicted_at IS NOT NULL;
CREATE VIEW public.core43_shadow_preview_v1 AS
WITH paired AS (
         SELECT nhl_core43_shadow_inputs.game_id,
            count(*) AS sides,
            count(*) FILTER (WHERE nhl_core43_shadow_inputs.goalie_id IS NOT NULL AND nhl_core43_shadow_inputs.gsax IS NOT NULL AND nhl_core43_shadow_inputs.shots_against >= 30 AND nhl_core43_shadow_inputs.gsax_fetched_at <= nhl_core43_shadow_inputs.prediction_at) AS valid_gsax_sides,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'away'::text) AS away_gsax_per100,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'home'::text) AS home_gsax_per100,
            count(*) FILTER (WHERE nhl_core43_shadow_inputs.starter_status = 'confirmed'::text) AS confirmed_sides
           FROM nhl_core43_shadow_inputs
          GROUP BY nhl_core43_shadow_inputs.game_id
        )
 SELECT a.game_id,
    a.game_date,
    a.away_team,
    a.home_team,
    a.core42_predicted_at,
    p.away_gsax_per100,
    p.home_gsax_per100,
    p.confirmed_sides,
        CASE
            WHEN p.sides = 2 AND p.valid_gsax_sides = 2 AND a.core42_away IS NOT NULL THEN round(GREATEST(0.4::double precision, LEAST(6.0::double precision, a.core42_away + GREATEST('-0.3'::numeric, LEAST(0.3, (p.away_gsax_per100 - p.home_gsax_per100) * 0.06))::double precision))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_preview_away,
        CASE
            WHEN p.sides = 2 AND p.valid_gsax_sides = 2 AND a.core42_home IS NOT NULL THEN round(GREATEST(0.4::double precision, LEAST(6.0::double precision, a.core42_home + GREATEST('-0.3'::numeric, LEAST(0.3, (p.home_gsax_per100 - p.away_gsax_per100) * 0.06))::double precision))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_preview_home,
        CASE
            WHEN p.sides = 2 AND p.valid_gsax_sides = 2 THEN 'provisional_goalies_not_confirmed'::text
            ELSE 'missing_pregame_gsax'::text
        END AS preview_status,
    'core43-gsax-preview-v1-unvalidated'::text AS version
   FROM nhl_prediction_archive a
     JOIN paired p USING (game_id)
  WHERE a.core42_predicted_at IS NOT NULL;
-- Production-equivalent readiness selection and time guards; synthetic source tables.
CREATE VIEW public.core43_shadow_readiness_v1 AS
WITH sides AS (
         SELECT a.game_id,
            a.game_date,
            a.core42_predicted_at AS prediction_at,
            'away'::text AS side,
            a.away_team AS team_code,
            (a.core42_factors -> 'away_goalie'::text) ->> 'name'::text AS goalie_name,
            (a.core42_factors -> 'away_goalie'::text) ->> 'nhl_player_id'::text AS goalie_id
           FROM nhl_prediction_archive a
          WHERE a.core42_predicted_at IS NOT NULL
        UNION ALL
         SELECT a.game_id,
            a.game_date,
            a.core42_predicted_at,
            'home'::text,
            a.home_team,
            (a.core42_factors -> 'home_goalie'::text) ->> 'name'::text,
            (a.core42_factors -> 'home_goalie'::text) ->> 'nhl_player_id'::text
           FROM nhl_prediction_archive a
          WHERE a.core42_predicted_at IS NOT NULL
        ), evidence AS (
         SELECT s.game_id,
            s.game_date,
            s.prediction_at,
            s.side,
            s.team_code,
            s.goalie_name,
            s.goalie_id,
            e.evidence_status,
            e.source_published_at,
            e.verified_at,
            g.gsax,
            g.shots_against,
            g.fetched_at AS gsax_fetched_at
           FROM sides s
             LEFT JOIN LATERAL ( SELECT e_1.id,
                    e_1.game_id,
                    e_1.team_code,
                    e_1.goalie_id,
                    e_1.evidence_status,
                    e_1.source_name,
                    e_1.source_url,
                    e_1.source_published_at,
                    e_1.verified_at,
                    e_1.created_at
                   FROM nhl_core43_starter_evidence e_1
                  WHERE e_1.game_id = s.game_id AND e_1.team_code = s.team_code AND e_1.goalie_id = s.goalie_id AND e_1.source_published_at <= s.prediction_at AND e_1.verified_at <= s.prediction_at
                  ORDER BY e_1.verified_at DESC
                 LIMIT 1) e ON true
             LEFT JOIN LATERAL ( SELECT g_1.id,
                    g_1.goalie_id,
                    g_1.team_code,
                    g_1.situation,
                    g_1.fetched_at,
                    g_1.source_sha256,
                    g_1.x_goals_against,
                    g_1.goals_against,
                    g_1.shots_against,
                    g_1.gsax,
                    g_1.created_at
                   FROM nhl_core43_goalie_snapshots g_1
                  WHERE g_1.goalie_id = s.goalie_id AND g_1.team_code = s.team_code AND g_1.situation = 'all'::text AND g_1.fetched_at <= s.prediction_at
                  ORDER BY g_1.fetched_at DESC
                 LIMIT 1) g ON true
        )
 SELECT game_id,
    game_date,
    side,
    team_code,
    goalie_name,
    goalie_id,
    prediction_at,
    evidence_status,
    source_published_at,
    verified_at,
    gsax,
    shots_against,
    gsax_fetched_at,
        CASE
            WHEN goalie_id IS NULL THEN 'missing_frozen_goalie_id'::text
            WHEN evidence_status IS NULL THEN 'missing_pregame_starter_evidence'::text
            WHEN lower(evidence_status) <> ALL (ARRAY['confirmed'::text, 'starting'::text, 'confirmed_starter'::text]) THEN 'starter_not_confirmed'::text
            WHEN gsax_fetched_at IS NULL THEN 'missing_pregame_gsax_snapshot'::text
            WHEN shots_against IS NULL OR shots_against < 30 THEN 'insufficient_shots'::text
            WHEN gsax IS NULL THEN 'missing_gsax'::text
            ELSE 'ready'::text
        END AS readiness
   FROM evidence;
-- Exact production view definition captured read-only in SECURITY-11.
CREATE VIEW public.nhl_core42_status AS
 SELECT count(*) FILTER (WHERE core42_predicted_at IS NOT NULL AND status = 'pending'::text)::integer AS pending_predictions,
    count(*) FILTER (WHERE core42_predicted_at IS NOT NULL AND status = 'final'::text)::integer AS finalized_predictions,
    count(*) FILTER (WHERE core42_goalie_review IS NOT NULL)::integer AS reviewed_goalies
   FROM nhl_prediction_archive;
-- Exact production view definition captured read-only in SECURITY-11.
CREATE VIEW public.nhl_core43_public_schedule_evidence WITH (security_barrier=true) AS
 SELECT DISTINCT game_id,
    kickoff_at,
    away_team,
    home_team
   FROM nhl_core43_schedule_snapshots
  WHERE game_id IS NOT NULL AND kickoff_at IS NOT NULL AND away_team IS NOT NULL AND home_team IS NOT NULL;
-- Exact production view definition from read-only pg_get_viewdef (SECURITY-16).
CREATE VIEW public.nhl_core_model_accuracy AS  WITH forecasts AS (
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.0'::text AS model,
            nhl_prediction_archive.baseline_away AS pred_away,
            nhl_prediction_archive.baseline_home AS pred_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.1'::text,
            nhl_prediction_archive.advanced_away,
            nhl_prediction_archive.advanced_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.2'::text,
            nhl_prediction_archive.goalie32_away,
            nhl_prediction_archive.goalie32_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.3'::text,
            nhl_prediction_archive.special33_away,
            nhl_prediction_archive.special33_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 4.0'::text,
            nhl_prediction_archive.core40_away,
            nhl_prediction_archive.core40_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 4.1'::text,
            nhl_prediction_archive.core41_away,
            nhl_prediction_archive.core41_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 4.2'::text,
            nhl_prediction_archive.core42_away,
            nhl_prediction_archive.core42_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        ), valid AS (
         SELECT forecasts.game_id,
            forecasts.actual_away,
            forecasts.actual_home,
            forecasts.model,
            forecasts.pred_away,
            forecasts.pred_home
           FROM forecasts
          WHERE forecasts.pred_away >= 0::double precision AND forecasts.pred_away <= 100::double precision AND forecasts.pred_home >= 0::double precision AND forecasts.pred_home <= 100::double precision AND forecasts.actual_away IS NOT NULL AND forecasts.actual_home IS NOT NULL
        ), scores AS (
         SELECT valid.game_id,
            valid.actual_away,
            valid.actual_home,
            valid.model,
            valid.pred_away,
            valid.pred_home,
            (abs(valid.pred_away - valid.actual_away::double precision) + abs(valid.pred_home - valid.actual_home::double precision)) / 2.0::double precision AS goal_mae,
            valid.pred_away > valid.pred_home AND valid.actual_away > valid.actual_home OR valid.pred_away < valid.pred_home AND valid.actual_away < valid.actual_home AS winner_correct,
            valid.pred_away = valid.pred_home AS predicted_tie
           FROM valid
        )
 SELECT model,
    count(*)::integer AS games,
    round(avg(goal_mae)::numeric, 3) AS goal_mae,
    count(*) FILTER (WHERE NOT predicted_tie)::integer AS winner_evaluable,
    count(*) FILTER (WHERE winner_correct)::integer AS winner_correct,
    round(100.0 * count(*) FILTER (WHERE winner_correct)::numeric / NULLIF(count(*) FILTER (WHERE NOT predicted_tie), 0)::numeric, 1) AS winner_accuracy_pct,
    round(avg(abs(pred_away + pred_home - (actual_away + actual_home)::double precision))::numeric, 3) AS total_goals_mae
   FROM scores
  GROUP BY model;;
-- Exact production view definition from read-only pg_get_viewdef (SECURITY-16).
CREATE VIEW public.nhl_core_model_head_to_head AS  WITH paired AS (
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            nhl_prediction_archive.core40_away,
            nhl_prediction_archive.core40_home,
            nhl_prediction_archive.core41_away,
            nhl_prediction_archive.core41_home,
            nhl_prediction_archive.baseline_away,
            nhl_prediction_archive.baseline_home,
            nhl_prediction_archive.advanced_away,
            nhl_prediction_archive.advanced_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text AND nhl_prediction_archive.actual_away IS NOT NULL AND nhl_prediction_archive.actual_home IS NOT NULL AND nhl_prediction_archive.core40_away IS NOT NULL AND nhl_prediction_archive.core40_home IS NOT NULL AND nhl_prediction_archive.core41_away IS NOT NULL AND nhl_prediction_archive.core41_home IS NOT NULL
        ), forecasts AS (
         SELECT paired.game_id,
            paired.actual_away,
            paired.actual_home,
            'CORE 3.0'::text AS model,
            paired.baseline_away AS away,
            paired.baseline_home AS home
           FROM paired
        UNION ALL
         SELECT paired.game_id,
            paired.actual_away,
            paired.actual_home,
            'CORE 3.1'::text,
            paired.advanced_away,
            paired.advanced_home
           FROM paired
        UNION ALL
         SELECT paired.game_id,
            paired.actual_away,
            paired.actual_home,
            'CORE 4.0'::text,
            paired.core40_away,
            paired.core40_home
           FROM paired
        UNION ALL
         SELECT paired.game_id,
            paired.actual_away,
            paired.actual_home,
            'CORE 4.1'::text,
            paired.core41_away,
            paired.core41_home
           FROM paired
        )
 SELECT model,
    count(*)::integer AS games,
    round(avg((abs(away - actual_away::double precision) + abs(home - actual_home::double precision)) / 2::double precision)::numeric, 3) AS goal_mae,
    count(*) FILTER (WHERE away > home AND actual_away > actual_home OR away < home AND actual_away < actual_home)::integer AS correct_winner,
    round(100.0 * count(*) FILTER (WHERE away > home AND actual_away > actual_home OR away < home AND actual_away < actual_home)::numeric / NULLIF(count(*) FILTER (WHERE away <> home), 0)::numeric, 1) AS winner_accuracy_pct
   FROM forecasts
  GROUP BY model;;
-- Exact production view definition from read-only pg_get_viewdef (SECURITY-16).
CREATE VIEW public.nhl_core_model_trend AS  WITH forecasts AS (
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.game_date,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.0'::text AS model,
            nhl_prediction_archive.baseline_away AS pa,
            nhl_prediction_archive.baseline_home AS ph
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.game_date,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.1'::text,
            nhl_prediction_archive.advanced_away,
            nhl_prediction_archive.advanced_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.game_date,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.2'::text,
            nhl_prediction_archive.goalie32_away,
            nhl_prediction_archive.goalie32_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.game_date,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 3.3'::text,
            nhl_prediction_archive.special33_away,
            nhl_prediction_archive.special33_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.game_date,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 4.0'::text,
            nhl_prediction_archive.core40_away,
            nhl_prediction_archive.core40_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.game_date,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 4.1'::text,
            nhl_prediction_archive.core41_away,
            nhl_prediction_archive.core41_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        UNION ALL
         SELECT nhl_prediction_archive.game_id,
            nhl_prediction_archive.game_date,
            nhl_prediction_archive.actual_away,
            nhl_prediction_archive.actual_home,
            'CORE 4.2'::text,
            nhl_prediction_archive.core42_away,
            nhl_prediction_archive.core42_home
           FROM nhl_prediction_archive
          WHERE nhl_prediction_archive.status = 'final'::text
        ), valid AS (
         SELECT forecasts.game_id,
            forecasts.game_date,
            forecasts.actual_away,
            forecasts.actual_home,
            forecasts.model,
            forecasts.pa,
            forecasts.ph,
                CASE
                    WHEN forecasts.pa > forecasts.ph AND forecasts.actual_away > forecasts.actual_home OR forecasts.pa < forecasts.ph AND forecasts.actual_away < forecasts.actual_home THEN 1
                    ELSE 0
                END AS correct,
            (abs(forecasts.pa - forecasts.actual_away::double precision) + abs(forecasts.ph - forecasts.actual_home::double precision)) / 2.0::double precision AS error
           FROM forecasts
          WHERE forecasts.pa >= 0::double precision AND forecasts.pa <= 100::double precision AND forecasts.ph >= 0::double precision AND forecasts.ph <= 100::double precision AND forecasts.actual_away IS NOT NULL AND forecasts.actual_home IS NOT NULL
        ), trend AS (
         SELECT valid.model,
            valid.game_id,
            valid.game_date,
            row_number() OVER (PARTITION BY valid.model ORDER BY valid.game_date, valid.game_id) AS games,
            sum(valid.correct) OVER (PARTITION BY valid.model ORDER BY valid.game_date, valid.game_id ROWS UNBOUNDED PRECEDING) AS wins,
            sum(
                CASE
                    WHEN valid.pa <> valid.ph THEN 1
                    ELSE 0
                END) OVER (PARTITION BY valid.model ORDER BY valid.game_date, valid.game_id ROWS UNBOUNDED PRECEDING) AS evaluable,
            avg(valid.error) OVER (PARTITION BY valid.model ORDER BY valid.game_date, valid.game_id ROWS UNBOUNDED PRECEDING) AS running_mae
           FROM valid
        )
 SELECT model,
    game_id,
    game_date,
    games::integer AS games,
    round(100.0 * wins::numeric / NULLIF(evaluable, 0)::numeric, 1) AS winner_accuracy_pct,
    round(running_mae::numeric, 3) AS goal_mae
   FROM trend;;
-- SECURITY-23: synthetic, owner-privileged capture path, modeled on read-only production function inspection.
-- Trigger created after fixture seeds to avoid changing earlier synthetic test cases.
CREATE FUNCTION public.capture_core43_shadow_inputs() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE inserted integer;
BEGIN
  WITH sides AS (
    SELECT a.game_id,a.core42_predicted_at AS prediction_at,'away'::text AS side,a.away_team AS team_code,
      a.core42_factors->'away_goalie'->>'name' AS goalie_name,
      a.core42_factors->'away_goalie'->>'nhl_player_id' AS goalie_id
    FROM public.nhl_prediction_archive a
    WHERE a.core42_predicted_at >= '2026-11-08 00:00:00+00'::timestamptz
      AND a.core42_predicted_at <= now()
    UNION ALL
    SELECT a.game_id,a.core42_predicted_at,'home',a.home_team,
      a.core42_factors->'home_goalie'->>'name',
      a.core42_factors->'home_goalie'->>'nhl_player_id'
    FROM public.nhl_prediction_archive a
    WHERE a.core42_predicted_at >= '2026-11-08 00:00:00+00'::timestamptz
      AND a.core42_predicted_at <= now()
  ), sources AS (
    SELECT s.*,g.gsax,g.shots_against,g.fetched_at AS gsax_fetched_at,
      e.evidence_status,e.source_published_at,e.verified_at
    FROM sides s
    LEFT JOIN LATERAL (
      SELECT g.* FROM public.nhl_core43_goalie_snapshots g
      WHERE g.goalie_id=s.goalie_id AND g.team_code=s.team_code AND g.situation='all'
        AND g.fetched_at<=s.prediction_at ORDER BY g.fetched_at DESC LIMIT 1
    ) g ON true
    LEFT JOIN LATERAL (
      SELECT e.* FROM public.nhl_core43_starter_evidence e
      WHERE e.game_id=s.game_id AND e.team_code=s.team_code AND e.goalie_id=s.goalie_id
        AND e.source_published_at<=s.prediction_at AND e.verified_at<=s.prediction_at
      ORDER BY e.verified_at DESC LIMIT 1
    ) e ON true
  ), saved AS (
    INSERT INTO public.nhl_core43_shadow_inputs
      (game_id,side,team_code,goalie_name,goalie_id,prediction_at,gsax,shots_against,
       gsax_fetched_at,starter_status,starter_published_at,starter_verified_at,readiness)
    SELECT game_id,side,team_code,goalie_name,goalie_id,prediction_at,gsax,shots_against,
      gsax_fetched_at,evidence_status,source_published_at,verified_at,
      CASE WHEN goalie_id IS NULL THEN 'missing_frozen_goalie_id'
           WHEN evidence_status IS NULL THEN 'missing_pregame_starter_evidence'
           WHEN lower(evidence_status) NOT IN ('confirmed','starting','confirmed_starter') THEN 'starter_not_confirmed'
           WHEN gsax_fetched_at IS NULL THEN 'missing_pregame_gsax_snapshot'
           WHEN shots_against IS NULL OR shots_against<30 THEN 'insufficient_shots'
           WHEN gsax IS NULL THEN 'missing_gsax'
           ELSE 'ready' END
    FROM sources ON CONFLICT (game_id,side) DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO inserted FROM saved;
  RETURN inserted;
END $function$;
CREATE FUNCTION public.core43_capture_on_core42_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF old.core42_predicted_at IS NULL AND new.core42_predicted_at IS NOT NULL THEN
    PERFORM public.capture_core43_shadow_inputs();
  END IF;
  RETURN new;
END $function$;
CREATE TRIGGER core43_shadow_on_core42 AFTER UPDATE OF core42_predicted_at
ON public.nhl_prediction_archive FOR EACH ROW
EXECUTE FUNCTION public.core43_capture_on_core42_insert();
REVOKE ALL ON FUNCTION public.capture_core43_shadow_inputs(),public.core43_capture_on_core42_insert() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_core43_shadow_inputs(),public.core43_capture_on_core42_insert() TO service_role;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT ALL ON TABLE public.nhl_core43_shadow_inputs,public.core43_shadow_predictions_v1,public.core43_shadow_preview_v1,public.core43_shadow_readiness_v1,public.nhl_core42_status TO anon,authenticated;
GRANT SELECT ON TABLE public.nhl_prediction_archive,public.nhl_core43_public_schedule_evidence,public.nhl_core_model_accuracy,public.nhl_core_model_head_to_head,public.nhl_core_model_trend TO anon,authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
