\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.nhl_prediction_archive ("actual_away" integer, "actual_home" integer, "advanced_away" double precision, "advanced_home" double precision, "baseline_away" double precision, "baseline_home" double precision, "core40_away" double precision, "core40_home" double precision, "core41_away" double precision, "core41_home" double precision, "core42_away" double precision, "core42_goalie_review" jsonb, "core42_home" double precision, "core42_predicted_at" timestamp with time zone, "game_date" date, "game_id" bigint, "goalie32_away" double precision, "goalie32_home" double precision, "special33_away" double precision, "special33_home" double precision, "status" text);
ALTER TABLE public.nhl_prediction_archive ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.nhl_prediction_archive TO anon,authenticated;
GRANT ALL ON public.nhl_prediction_archive TO service_role;
CREATE POLICY read_archive ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (true);
\if :{?real_snapshot}
\ir security_analytics_snapshot_input.sql
\else
INSERT INTO public.nhl_prediction_archive (actual_away,actual_home,advanced_away,advanced_home,baseline_away,baseline_home,core40_away,core40_home,core41_away,core41_home,core42_away,core42_goalie_review,core42_home,core42_predicted_at,game_date,game_id,goalie32_away,goalie32_home,special33_away,special33_home,status) VALUES (2,3,2,4,2,4,2,4,2,4,2,NULL,4,'2026-11-10 12:00:00+00','2026-11-11','2026020001',2,4,2,4,'final'),(3,3,3,3,3,3,3,3,3,3,3,NULL,3,'2026-11-10 12:00:00+00','2026-11-12','2026020002',3,3,3,3,'final'),(1,3,2,4,2,4,2,4,2,4,NULL,NULL,NULL,NULL,'2026-11-13','2026020003',2,4,2,4,'final'),(NULL,NULL,2,4,2,4,2,4,2,4,2,NULL,4,'2026-11-10 12:00:00+00','2026-11-14','2026020004',2,4,2,4,'pending');
\endif
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
  GROUP BY model;
GRANT SELECT,MAINTAIN ON public.nhl_core_model_accuracy TO anon,authenticated;
GRANT ALL ON public.nhl_core_model_accuracy TO service_role;
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
  GROUP BY model;
GRANT SELECT,MAINTAIN ON public.nhl_core_model_head_to_head TO anon,authenticated;
GRANT ALL ON public.nhl_core_model_head_to_head TO service_role;
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
   FROM trend;
GRANT SELECT,MAINTAIN ON public.nhl_core_model_trend TO anon,authenticated;
GRANT ALL ON public.nhl_core_model_trend TO service_role;
CREATE VIEW public.nhl_core42_status AS  SELECT count(*) FILTER (WHERE core42_predicted_at IS NOT NULL AND status = 'pending'::text)::integer AS pending_predictions,
    count(*) FILTER (WHERE core42_predicted_at IS NOT NULL AND status = 'final'::text)::integer AS finalized_predictions,
    count(*) FILTER (WHERE core42_goalie_review IS NOT NULL)::integer AS reviewed_goalies
   FROM nhl_prediction_archive;
GRANT SELECT,MAINTAIN ON public.nhl_core42_status TO anon,authenticated;
GRANT ALL ON public.nhl_core42_status TO service_role;
CREATE TEMP TABLE metadata_before AS SELECT oid,relacl,pg_get_viewdef(oid,true) definition FROM pg_class WHERE oid IN ('public.nhl_core42_status'::regclass,'public.nhl_core_model_accuracy'::regclass,'public.nhl_core_model_head_to_head'::regclass,'public.nhl_core_model_trend'::regclass);
CREATE TEMP TABLE before_anon_0 AS SELECT * FROM public.nhl_core42_status WITH NO DATA;
GRANT SELECT,INSERT ON before_anon_0 TO anon;
SET LOCAL ROLE anon;
INSERT INTO before_anon_0 SELECT * FROM public.nhl_core42_status;
RESET ROLE;
CREATE TEMP TABLE before_anon_1 AS SELECT * FROM public.nhl_core_model_accuracy WITH NO DATA;
GRANT SELECT,INSERT ON before_anon_1 TO anon;
SET LOCAL ROLE anon;
INSERT INTO before_anon_1 SELECT * FROM public.nhl_core_model_accuracy;
RESET ROLE;
CREATE TEMP TABLE before_anon_2 AS SELECT * FROM public.nhl_core_model_head_to_head WITH NO DATA;
GRANT SELECT,INSERT ON before_anon_2 TO anon;
SET LOCAL ROLE anon;
INSERT INTO before_anon_2 SELECT * FROM public.nhl_core_model_head_to_head;
RESET ROLE;
CREATE TEMP TABLE before_anon_3 AS SELECT * FROM public.nhl_core_model_trend WITH NO DATA;
GRANT SELECT,INSERT ON before_anon_3 TO anon;
SET LOCAL ROLE anon;
INSERT INTO before_anon_3 SELECT * FROM public.nhl_core_model_trend;
RESET ROLE;
CREATE TEMP TABLE before_authenticated_0 AS SELECT * FROM public.nhl_core42_status WITH NO DATA;
GRANT SELECT,INSERT ON before_authenticated_0 TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO before_authenticated_0 SELECT * FROM public.nhl_core42_status;
RESET ROLE;
CREATE TEMP TABLE before_authenticated_1 AS SELECT * FROM public.nhl_core_model_accuracy WITH NO DATA;
GRANT SELECT,INSERT ON before_authenticated_1 TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO before_authenticated_1 SELECT * FROM public.nhl_core_model_accuracy;
RESET ROLE;
CREATE TEMP TABLE before_authenticated_2 AS SELECT * FROM public.nhl_core_model_head_to_head WITH NO DATA;
GRANT SELECT,INSERT ON before_authenticated_2 TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO before_authenticated_2 SELECT * FROM public.nhl_core_model_head_to_head;
RESET ROLE;
CREATE TEMP TABLE before_authenticated_3 AS SELECT * FROM public.nhl_core_model_trend WITH NO DATA;
GRANT SELECT,INSERT ON before_authenticated_3 TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO before_authenticated_3 SELECT * FROM public.nhl_core_model_trend;
RESET ROLE;
CREATE TEMP TABLE before_service_role_0 AS SELECT * FROM public.nhl_core42_status WITH NO DATA;
GRANT SELECT,INSERT ON before_service_role_0 TO service_role;
SET LOCAL ROLE service_role;
INSERT INTO before_service_role_0 SELECT * FROM public.nhl_core42_status;
RESET ROLE;
CREATE TEMP TABLE before_service_role_1 AS SELECT * FROM public.nhl_core_model_accuracy WITH NO DATA;
GRANT SELECT,INSERT ON before_service_role_1 TO service_role;
SET LOCAL ROLE service_role;
INSERT INTO before_service_role_1 SELECT * FROM public.nhl_core_model_accuracy;
RESET ROLE;
CREATE TEMP TABLE before_service_role_2 AS SELECT * FROM public.nhl_core_model_head_to_head WITH NO DATA;
GRANT SELECT,INSERT ON before_service_role_2 TO service_role;
SET LOCAL ROLE service_role;
INSERT INTO before_service_role_2 SELECT * FROM public.nhl_core_model_head_to_head;
RESET ROLE;
CREATE TEMP TABLE before_service_role_3 AS SELECT * FROM public.nhl_core_model_trend WITH NO DATA;
GRANT SELECT,INSERT ON before_service_role_3 TO service_role;
SET LOCAL ROLE service_role;
INSERT INTO before_service_role_3 SELECT * FROM public.nhl_core_model_trend;
RESET ROLE;
\ir security_analytics_invoker_proposal.sql
DO $$ BEGIN IF EXISTS (SELECT 1 FROM metadata_before b JOIN pg_class c ON c.oid=b.oid WHERE c.relacl IS DISTINCT FROM b.relacl OR pg_get_viewdef(c.oid,true) IS DISTINCT FROM b.definition OR NOT coalesce(c.reloptions @> ARRAY['security_invoker=true'],false)) THEN RAISE EXCEPTION 'metadata mismatch'; END IF; END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_anon_0) UNION ALL (SELECT * FROM before_anon_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_anon_1) UNION ALL (SELECT * FROM before_anon_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_anon_2) UNION ALL (SELECT * FROM before_anon_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_anon_3) UNION ALL (SELECT * FROM before_anon_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_authenticated_0) UNION ALL (SELECT * FROM before_authenticated_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_authenticated_1) UNION ALL (SELECT * FROM before_authenticated_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_authenticated_2) UNION ALL (SELECT * FROM before_authenticated_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_authenticated_3) UNION ALL (SELECT * FROM before_authenticated_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_service_role_0) UNION ALL (SELECT * FROM before_service_role_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_service_role_1) UNION ALL (SELECT * FROM before_service_role_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_service_role_2) UNION ALL (SELECT * FROM before_service_role_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_service_role_3) UNION ALL (SELECT * FROM before_service_role_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
DROP POLICY read_archive ON public.nhl_prediction_archive;
CREATE POLICY read_archive ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (false);
SET LOCAL ROLE anon;
DO $$ BEGIN IF (SELECT pending_predictions+finalized_predictions+reviewed_goalies FROM public.nhl_core42_status) <> 0 OR EXISTS(SELECT 1 FROM public.nhl_core_model_accuracy) OR EXISTS(SELECT 1 FROM public.nhl_core_model_head_to_head) OR EXISTS(SELECT 1 FROM public.nhl_core_model_trend) THEN RAISE EXCEPTION 'RLS not enforced'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF (SELECT pending_predictions+finalized_predictions+reviewed_goalies FROM public.nhl_core42_status) <> 0 OR EXISTS(SELECT 1 FROM public.nhl_core_model_accuracy) OR EXISTS(SELECT 1 FROM public.nhl_core_model_head_to_head) OR EXISTS(SELECT 1 FROM public.nhl_core_model_trend) THEN RAISE EXCEPTION 'RLS not enforced'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_service_role_0) UNION ALL (SELECT * FROM before_service_role_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_service_role_1) UNION ALL (SELECT * FROM before_service_role_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_service_role_2) UNION ALL (SELECT * FROM before_service_role_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_service_role_3) UNION ALL (SELECT * FROM before_service_role_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
\ir security_analytics_invoker_rollback.sql
DO $$ BEGIN IF EXISTS (SELECT 1 FROM metadata_before b JOIN pg_class c ON c.oid=b.oid WHERE c.relacl IS DISTINCT FROM b.relacl OR pg_get_viewdef(c.oid,true) IS DISTINCT FROM b.definition OR c.reloptions IS NOT NULL) THEN RAISE EXCEPTION 'metadata mismatch'; END IF; END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_anon_0) UNION ALL (SELECT * FROM before_anon_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_anon_1) UNION ALL (SELECT * FROM before_anon_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_anon_2) UNION ALL (SELECT * FROM before_anon_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_anon_3) UNION ALL (SELECT * FROM before_anon_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_authenticated_0) UNION ALL (SELECT * FROM before_authenticated_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_authenticated_1) UNION ALL (SELECT * FROM before_authenticated_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_authenticated_2) UNION ALL (SELECT * FROM before_authenticated_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_authenticated_3) UNION ALL (SELECT * FROM before_authenticated_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_service_role_0) UNION ALL (SELECT * FROM before_service_role_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_service_role_1) UNION ALL (SELECT * FROM before_service_role_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_service_role_2) UNION ALL (SELECT * FROM before_service_role_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_service_role_3) UNION ALL (SELECT * FROM before_service_role_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
DROP POLICY read_archive ON public.nhl_prediction_archive;
CREATE POLICY read_archive ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (true);
SET LOCAL ROLE anon;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_anon_0) UNION ALL (SELECT * FROM before_anon_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_anon_1) UNION ALL (SELECT * FROM before_anon_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_anon_2) UNION ALL (SELECT * FROM before_anon_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_anon_3) UNION ALL (SELECT * FROM before_anon_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch anon nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_authenticated_0) UNION ALL (SELECT * FROM before_authenticated_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_authenticated_1) UNION ALL (SELECT * FROM before_authenticated_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_authenticated_2) UNION ALL (SELECT * FROM before_authenticated_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_authenticated_3) UNION ALL (SELECT * FROM before_authenticated_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch authenticated nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.nhl_core42_status EXCEPT ALL SELECT * FROM before_service_role_0) UNION ALL (SELECT * FROM before_service_role_0 EXCEPT ALL SELECT * FROM public.nhl_core42_status)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core42_status'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_accuracy EXCEPT ALL SELECT * FROM before_service_role_1) UNION ALL (SELECT * FROM before_service_role_1 EXCEPT ALL SELECT * FROM public.nhl_core_model_accuracy)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_accuracy'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_head_to_head EXCEPT ALL SELECT * FROM before_service_role_2) UNION ALL (SELECT * FROM before_service_role_2 EXCEPT ALL SELECT * FROM public.nhl_core_model_head_to_head)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_head_to_head'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core_model_trend EXCEPT ALL SELECT * FROM before_service_role_3) UNION ALL (SELECT * FROM before_service_role_3 EXCEPT ALL SELECT * FROM public.nhl_core_model_trend)) THEN RAISE EXCEPTION 'row mismatch service_role nhl_core_model_trend'; END IF;
END $$;
RESET ROLE;
\echo All three roles: parity, restrictive RLS and rollback checks passed
ROLLBACK;
