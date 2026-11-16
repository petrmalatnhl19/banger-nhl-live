-- SECURITY-09: synthetic schema only. NO production data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.nhl_core43_shadow_inputs (game_id bigint, side text, gsax numeric, shots_against integer, readiness text, goalie_id text, gsax_fetched_at timestamptz, prediction_at timestamptz, starter_status text);
CREATE TABLE public.nhl_prediction_archive (game_id bigint PRIMARY KEY, prediction numeric, core42_predicted_at timestamptz, status text, core42_goalie_review jsonb, game_date date, away_team text, home_team text, core42_away double precision, core42_home double precision);
CREATE TABLE public.nhl_core43_goalie_snapshots (game_id bigint, goalie_name text);
CREATE TABLE public.nhl_core43_starter_evidence (game_id bigint, evidence_status text);
CREATE TABLE public.nhl_core43_schedule_snapshots (game_id bigint, kickoff_at timestamptz, away_team text, home_team text);
ALTER TABLE public.nhl_core43_shadow_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhl_prediction_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_read ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (true);
INSERT INTO public.nhl_core43_shadow_inputs VALUES (1,'away',1.2,40,'ready','A',now()-interval '2 hours',now()-interval '1 hour','confirmed'),(1,'home',0.8,40,'ready','H',now()-interval '2 hours',now()-interval '1 hour','confirmed');
INSERT INTO public.nhl_prediction_archive (game_id,prediction,core42_predicted_at,status,core42_goalie_review,game_date,away_team,home_team,core42_away,core42_home) VALUES (1,3.4,now(),'pending',NULL,current_date,'DAL','BOS',2.7,2.4);
INSERT INTO public.nhl_core43_goalie_snapshots VALUES (1,'Fixture goalie');
INSERT INTO public.nhl_core43_starter_evidence VALUES (1,'fixture');
INSERT INTO public.nhl_core43_schedule_snapshots VALUES (1,now(),'DAL','BOS');
-- Production-equivalent SQL from read-only pg_get_viewdef inspection (SECURITY-11).
CREATE VIEW public.core43_shadow_predictions_v1 AS
 WITH inputs AS (
  SELECT game_id,
   max(gsax * 100.0 / NULLIF(shots_against,0)::numeric) FILTER (WHERE side='away') AS away_gsax_per100,
   max(gsax * 100.0 / NULLIF(shots_against,0)::numeric) FILTER (WHERE side='home') AS home_gsax_per100,
   count(*) FILTER (WHERE readiness='ready') AS ready_sides,
   count(*) AS total_sides
  FROM nhl_core43_shadow_inputs GROUP BY game_id
 )
 SELECT a.game_id,a.game_date,a.away_team,a.home_team,a.status,a.core42_away,a.core42_home,
 i.away_gsax_per100,i.home_gsax_per100,i.ready_sides,i.total_sides,
 CASE WHEN i.ready_sides=2 AND i.total_sides=2 AND a.core42_away IS NOT NULL AND a.core42_home IS NOT NULL
 THEN round(GREATEST(0.4::double precision,LEAST(6.0::double precision,a.core42_away+GREATEST(-0.3::numeric,LEAST(0.3,(i.away_gsax_per100-i.home_gsax_per100)*0.06))::double precision))::numeric,3)
 ELSE NULL::numeric END AS core43_away,
 CASE WHEN i.ready_sides=2 AND i.total_sides=2 AND a.core42_away IS NOT NULL AND a.core42_home IS NOT NULL
 THEN round(GREATEST(0.4::double precision,LEAST(6.0::double precision,a.core42_home+GREATEST(-0.3::numeric,LEAST(0.3,(i.home_gsax_per100-i.away_gsax_per100)*0.06))::double precision))::numeric,3)
 ELSE NULL::numeric END AS core43_home,
 CASE WHEN i.ready_sides=2 AND i.total_sides=2 THEN 'experimental_ready'::text ELSE 'awaiting_verified_pregame_inputs'::text END AS experiment_status,
 'core43-shadow-gsax-v1-heuristic-unvalidated'::text AS model_version
 FROM nhl_prediction_archive a JOIN inputs i USING(game_id) WHERE a.core42_predicted_at IS NOT NULL;
CREATE VIEW public.core43_shadow_preview_v1 AS
 WITH paired AS (
  SELECT game_id,count(*) AS sides,
  count(*) FILTER (WHERE goalie_id IS NOT NULL AND gsax IS NOT NULL AND shots_against>=30 AND gsax_fetched_at<=prediction_at) AS valid_gsax_sides,
  max(gsax*100.0/NULLIF(shots_against,0)::numeric) FILTER (WHERE side='away') AS away_gsax_per100,
  max(gsax*100.0/NULLIF(shots_against,0)::numeric) FILTER (WHERE side='home') AS home_gsax_per100,
  count(*) FILTER (WHERE starter_status='confirmed') AS confirmed_sides
  FROM nhl_core43_shadow_inputs GROUP BY game_id
 )
 SELECT a.game_id,a.game_date,a.away_team,a.home_team,a.core42_predicted_at,
 p.away_gsax_per100,p.home_gsax_per100,p.confirmed_sides,
 CASE WHEN p.sides=2 AND p.valid_gsax_sides=2 AND a.core42_away IS NOT NULL
 THEN round(GREATEST(0.4::double precision,LEAST(6.0::double precision,a.core42_away+GREATEST(-0.3::numeric,LEAST(0.3,(p.away_gsax_per100-p.home_gsax_per100)*0.06))::double precision))::numeric,3)
 ELSE NULL::numeric END AS core43_preview_away,
 CASE WHEN p.sides=2 AND p.valid_gsax_sides=2 AND a.core42_home IS NOT NULL
 THEN round(GREATEST(0.4::double precision,LEAST(6.0::double precision,a.core42_home+GREATEST(-0.3::numeric,LEAST(0.3,(p.home_gsax_per100-p.away_gsax_per100)*0.06))::double precision))::numeric,3)
 ELSE NULL::numeric END AS core43_preview_home,
 CASE WHEN p.sides=2 AND p.valid_gsax_sides=2 THEN 'provisional_goalies_not_confirmed'::text ELSE 'missing_pregame_gsax'::text END AS preview_status,
 'core43-gsax-preview-v1-unvalidated'::text AS version
 FROM nhl_prediction_archive a JOIN paired p USING(game_id) WHERE a.core42_predicted_at IS NOT NULL;
CREATE VIEW public.core43_shadow_readiness_v1 AS SELECT g.game_id,g.goalie_name,e.evidence_status FROM public.nhl_core43_goalie_snapshots g JOIN public.nhl_core43_starter_evidence e USING(game_id);
-- Exact production view definition captured read-only in SECURITY-11.
CREATE VIEW public.nhl_core42_status AS
 SELECT count(*) FILTER (WHERE core42_predicted_at IS NOT NULL AND status = 'pending'::text)::integer AS pending_predictions,
    count(*) FILTER (WHERE core42_predicted_at IS NOT NULL AND status = 'final'::text)::integer AS finalized_predictions,
    count(*) FILTER (WHERE core42_goalie_review IS NOT NULL)::integer AS reviewed_goalies
   FROM nhl_prediction_archive;
-- Exact production view definition captured read-only in SECURITY-11.
CREATE VIEW public.nhl_core43_public_schedule_evidence AS
 SELECT DISTINCT game_id,
    kickoff_at,
    away_team,
    home_team
   FROM nhl_core43_schedule_snapshots
  WHERE game_id IS NOT NULL AND kickoff_at IS NOT NULL AND away_team IS NOT NULL AND home_team IS NOT NULL;
CREATE VIEW public.nhl_core_model_accuracy AS SELECT count(*) AS games FROM public.nhl_prediction_archive;
CREATE VIEW public.nhl_core_model_head_to_head AS SELECT count(*) AS games FROM public.nhl_prediction_archive;
CREATE VIEW public.nhl_core_model_trend AS SELECT game_id FROM public.nhl_prediction_archive;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT ALL ON TABLE public.nhl_core43_shadow_inputs,public.core43_shadow_predictions_v1,public.core43_shadow_preview_v1,public.core43_shadow_readiness_v1,public.nhl_core42_status TO anon,authenticated;
GRANT SELECT ON TABLE public.nhl_prediction_archive,public.nhl_core43_public_schedule_evidence,public.nhl_core_model_accuracy,public.nhl_core_model_head_to_head,public.nhl_core_model_trend TO anon,authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
