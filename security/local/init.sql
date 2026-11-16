-- SECURITY-09: synthetic schema only. NO production data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.nhl_core43_shadow_inputs (game_id bigint PRIMARY KEY, gsax numeric);
CREATE TABLE public.nhl_prediction_archive (game_id bigint PRIMARY KEY, prediction numeric, core42_predicted_at timestamptz, status text, core42_goalie_review jsonb);
CREATE TABLE public.nhl_core43_goalie_snapshots (game_id bigint, goalie_name text);
CREATE TABLE public.nhl_core43_starter_evidence (game_id bigint, evidence_status text);
CREATE TABLE public.nhl_core43_schedule_snapshots (game_id bigint, kickoff_at timestamptz, away_team text, home_team text);
ALTER TABLE public.nhl_core43_shadow_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhl_prediction_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_read ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (true);
INSERT INTO public.nhl_core43_shadow_inputs VALUES (1,1.2);
INSERT INTO public.nhl_prediction_archive (game_id,prediction,core42_predicted_at,status,core42_goalie_review) VALUES (1,3.4,now(),'pending',NULL);
INSERT INTO public.nhl_core43_goalie_snapshots VALUES (1,'Fixture goalie');
INSERT INTO public.nhl_core43_starter_evidence VALUES (1,'fixture');
INSERT INTO public.nhl_core43_schedule_snapshots VALUES (1,now(),'DAL','BOS');
CREATE VIEW public.core43_shadow_predictions_v1 AS SELECT s.game_id,s.gsax FROM public.nhl_core43_shadow_inputs s;
CREATE VIEW public.core43_shadow_preview_v1 AS SELECT s.game_id,s.gsax FROM public.nhl_core43_shadow_inputs s;
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
