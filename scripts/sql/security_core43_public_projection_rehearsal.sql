\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.nhl_core43_schedule_snapshots(game_id bigint,kickoff_at timestamptz,away_team text,home_team text);
CREATE TABLE public.nhl_prediction_archive(game_id bigint,game_date date,away_team text,home_team text,status text,core42_away double precision,core42_home double precision,core42_predicted_at timestamptz);
CREATE TABLE public.core43_verified_shadow_inputs(game_id bigint,side text,gsax numeric,shots_against integer,readiness text,goalie_id bigint,gsax_fetched_at timestamptz,prediction_at timestamptz,starter_status text);
INSERT INTO nhl_core43_schedule_snapshots VALUES (1,'2026-11-28 20:00Z','DAL','VGK'),(1,'2026-11-28 20:00Z','DAL','VGK'),(2,NULL,'DAL','VGK');
INSERT INTO nhl_prediction_archive VALUES (1,'2026-11-28','DAL','VGK','FINAL',3,2,'2026-11-28 19:00Z'),(2,'2026-11-28','DAL','VGK','FUT',NULL,2,'2026-11-28 19:00Z');
INSERT INTO core43_verified_shadow_inputs VALUES (1,'away',2,100,'ready',10,'2026-11-28 18:00Z','2026-11-28 19:00Z','confirmed'),(1,'home',-1,100,'ready',11,'2026-11-28 18:00Z','2026-11-28 19:00Z','confirmed'),(2,'away',NULL,10,'missing',NULL,NULL,'2026-11-28 19:00Z',NULL);
ALTER TABLE nhl_core43_schedule_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE core43_verified_shadow_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_prediction_archive ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON nhl_prediction_archive TO anon,authenticated;
CREATE POLICY archive_read ON nhl_prediction_archive FOR SELECT TO anon,authenticated USING(true);
CREATE SCHEMA publication;
GRANT USAGE ON SCHEMA publication TO anon,authenticated,service_role;
CREATE VIEW public.core43_shadow_predictions_v1  AS WITH inputs AS (
         SELECT nhl_core43_shadow_inputs.game_id,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'away'::text) AS away_gsax_per100,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'home'::text) AS home_gsax_per100,
            count(*) FILTER (WHERE nhl_core43_shadow_inputs.readiness = 'ready'::text) AS ready_sides,
            count(*) AS total_sides
           FROM core43_verified_shadow_inputs nhl_core43_shadow_inputs
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
GRANT SELECT ON public.core43_shadow_predictions_v1 TO anon,authenticated,service_role;
CREATE TABLE publication.core43_shadow_predictions_v1 AS SELECT * FROM public.core43_shadow_predictions_v1;
ALTER TABLE publication.core43_shadow_predictions_v1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_read ON publication.core43_shadow_predictions_v1 FOR SELECT TO anon,authenticated,service_role USING(true);
GRANT SELECT ON publication.core43_shadow_predictions_v1 TO anon,authenticated,service_role;
CREATE TEMP TABLE before_core43_shadow_predictions_v1 AS SELECT * FROM public.core43_shadow_predictions_v1;
GRANT SELECT ON before_core43_shadow_predictions_v1 TO anon,authenticated,service_role;
CREATE OR REPLACE VIEW public.core43_shadow_predictions_v1 WITH (security_invoker=true) AS SELECT * FROM publication.core43_shadow_predictions_v1;
CREATE VIEW public.core43_shadow_preview_v1  AS WITH paired AS (
         SELECT nhl_core43_shadow_inputs.game_id,
            count(*) AS sides,
            count(*) FILTER (WHERE nhl_core43_shadow_inputs.goalie_id IS NOT NULL AND nhl_core43_shadow_inputs.gsax IS NOT NULL AND nhl_core43_shadow_inputs.shots_against >= 30 AND nhl_core43_shadow_inputs.gsax_fetched_at <= nhl_core43_shadow_inputs.prediction_at) AS valid_gsax_sides,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'away'::text) AS away_gsax_per100,
            max(nhl_core43_shadow_inputs.gsax * 100.0 / NULLIF(nhl_core43_shadow_inputs.shots_against, 0)::numeric) FILTER (WHERE nhl_core43_shadow_inputs.side = 'home'::text) AS home_gsax_per100,
            count(*) FILTER (WHERE nhl_core43_shadow_inputs.starter_status = 'confirmed'::text) AS confirmed_sides
           FROM core43_verified_shadow_inputs nhl_core43_shadow_inputs
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
GRANT SELECT ON public.core43_shadow_preview_v1 TO anon,authenticated,service_role;
CREATE TABLE publication.core43_shadow_preview_v1 AS SELECT * FROM public.core43_shadow_preview_v1;
ALTER TABLE publication.core43_shadow_preview_v1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_read ON publication.core43_shadow_preview_v1 FOR SELECT TO anon,authenticated,service_role USING(true);
GRANT SELECT ON publication.core43_shadow_preview_v1 TO anon,authenticated,service_role;
CREATE TEMP TABLE before_core43_shadow_preview_v1 AS SELECT * FROM public.core43_shadow_preview_v1;
GRANT SELECT ON before_core43_shadow_preview_v1 TO anon,authenticated,service_role;
CREATE OR REPLACE VIEW public.core43_shadow_preview_v1 WITH (security_invoker=true) AS SELECT * FROM publication.core43_shadow_preview_v1;
CREATE VIEW public.nhl_core43_public_schedule_evidence WITH (security_barrier=true) AS SELECT DISTINCT game_id,
    kickoff_at,
    away_team,
    home_team
   FROM nhl_core43_schedule_snapshots
  WHERE game_id IS NOT NULL AND kickoff_at IS NOT NULL AND away_team IS NOT NULL AND home_team IS NOT NULL;
GRANT SELECT ON public.nhl_core43_public_schedule_evidence TO anon,authenticated,service_role;
CREATE TABLE publication.nhl_core43_public_schedule_evidence AS SELECT * FROM public.nhl_core43_public_schedule_evidence;
ALTER TABLE publication.nhl_core43_public_schedule_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY published_read ON publication.nhl_core43_public_schedule_evidence FOR SELECT TO anon,authenticated,service_role USING(true);
GRANT SELECT ON publication.nhl_core43_public_schedule_evidence TO anon,authenticated,service_role;
CREATE TEMP TABLE before_nhl_core43_public_schedule_evidence AS SELECT * FROM public.nhl_core43_public_schedule_evidence;
GRANT SELECT ON before_nhl_core43_public_schedule_evidence TO anon,authenticated,service_role;
CREATE OR REPLACE VIEW public.nhl_core43_public_schedule_evidence WITH (security_invoker=true) AS SELECT * FROM publication.nhl_core43_public_schedule_evidence;
SET LOCAL ROLE anon;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM before_core43_shadow_predictions_v1) UNION ALL (SELECT * FROM before_core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_predictions_v1)) THEN RAISE EXCEPTION 'parity anon core43_shadow_predictions_v1'; END IF;
IF has_table_privilege(current_user,'publication.core43_shadow_predictions_v1','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
IF EXISTS ((SELECT * FROM public.core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM before_core43_shadow_preview_v1) UNION ALL (SELECT * FROM before_core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_preview_v1)) THEN RAISE EXCEPTION 'parity anon core43_shadow_preview_v1'; END IF;
IF has_table_privilege(current_user,'publication.core43_shadow_preview_v1','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM before_nhl_core43_public_schedule_evidence) UNION ALL (SELECT * FROM before_nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM public.nhl_core43_public_schedule_evidence)) THEN RAISE EXCEPTION 'parity anon nhl_core43_public_schedule_evidence'; END IF;
IF has_table_privilege(current_user,'publication.nhl_core43_public_schedule_evidence','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM before_core43_shadow_predictions_v1) UNION ALL (SELECT * FROM before_core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_predictions_v1)) THEN RAISE EXCEPTION 'parity authenticated core43_shadow_predictions_v1'; END IF;
IF has_table_privilege(current_user,'publication.core43_shadow_predictions_v1','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
IF EXISTS ((SELECT * FROM public.core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM before_core43_shadow_preview_v1) UNION ALL (SELECT * FROM before_core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_preview_v1)) THEN RAISE EXCEPTION 'parity authenticated core43_shadow_preview_v1'; END IF;
IF has_table_privilege(current_user,'publication.core43_shadow_preview_v1','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM before_nhl_core43_public_schedule_evidence) UNION ALL (SELECT * FROM before_nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM public.nhl_core43_public_schedule_evidence)) THEN RAISE EXCEPTION 'parity authenticated nhl_core43_public_schedule_evidence'; END IF;
IF has_table_privilege(current_user,'publication.nhl_core43_public_schedule_evidence','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
IF EXISTS ((SELECT * FROM public.core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM before_core43_shadow_predictions_v1) UNION ALL (SELECT * FROM before_core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_predictions_v1)) THEN RAISE EXCEPTION 'parity service_role core43_shadow_predictions_v1'; END IF;
IF has_table_privilege(current_user,'publication.core43_shadow_predictions_v1','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
IF EXISTS ((SELECT * FROM public.core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM before_core43_shadow_preview_v1) UNION ALL (SELECT * FROM before_core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_preview_v1)) THEN RAISE EXCEPTION 'parity service_role core43_shadow_preview_v1'; END IF;
IF has_table_privilege(current_user,'publication.core43_shadow_preview_v1','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM before_nhl_core43_public_schedule_evidence) UNION ALL (SELECT * FROM before_nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM public.nhl_core43_public_schedule_evidence)) THEN RAISE EXCEPTION 'parity service_role nhl_core43_public_schedule_evidence'; END IF;
IF has_table_privilege(current_user,'publication.nhl_core43_public_schedule_evidence','INSERT') THEN RAISE EXCEPTION 'write grant'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF has_table_privilege('anon','public.nhl_core43_schedule_snapshots','SELECT') OR has_table_privilege('authenticated','public.core43_verified_shadow_inputs','SELECT') THEN RAISE EXCEPTION 'private access'; END IF; END $$;
ROLLBACK;
