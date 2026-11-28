\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.nhl_core43_schedule_snapshots(game_id bigint,kickoff_at timestamptz,away_team text,home_team text);
CREATE TABLE public.nhl_prediction_archive(game_id bigint,game_date date,away_team text,home_team text,status text,core42_away double precision,core42_home double precision,core42_predicted_at timestamptz);
CREATE TABLE public.nhl_core43_shadow_inputs(game_id bigint,side text,team_code text,goalie_name text,goalie_id text,prediction_at timestamptz,captured_at timestamptz,gsax numeric,shots_against integer,gsax_fetched_at timestamptz,starter_status text,starter_published_at timestamptz,starter_verified_at timestamptz,readiness text);
CREATE TABLE public.nhl_core43_starter_evidence(id bigint,game_id bigint,team_code text,goalie_id text,evidence_status text,source_name text,source_url text,source_published_at timestamptz,verified_at timestamptz,created_at timestamptz,article_text text,source_snapshot_at timestamptz,observed_at timestamptz);
CREATE VIEW public.core43_verified_starter_evidence WITH (security_invoker=false) AS SELECT id,
    game_id,
    team_code,
    goalie_id,
    evidence_status,
    source_name,
    source_url,
    source_published_at,
    verified_at,
    created_at,
    article_text,
    source_snapshot_at,
    observed_at
   FROM nhl_core43_starter_evidence e
  WHERE NULLIF(btrim(article_text), ''::text) IS NOT NULL AND evidence_status = 'confirmed'::text AND source_url ~ '^https://[^/]+/.+'::text AND goalie_id ~ '^[0-9]+$'::text AND (lower(source_name) <> 'rotowire'::text OR source_url ~ '^https://(www[.])?rotowire[.]com/hockey/headlines/[^/?#]+$'::text) AND source_published_at <= verified_at AND verified_at <= now() AND (observed_at >= source_published_at AND observed_at <= verified_at OR id = 1590740 AND observed_at IS NULL AND source_snapshot_at IS NULL) AND (source_snapshot_at IS NULL OR source_snapshot_at >= source_published_at AND source_snapshot_at <= observed_at) AND (EXISTS ( SELECT
           FROM nhl_core43_schedule_snapshots s
          WHERE s.game_id = e.game_id
          GROUP BY s.game_id
         HAVING bool_and(e.team_code = s.away_team OR e.team_code = s.home_team) AND count(DISTINCT ROW(s.away_team, s.home_team, s.kickoff_at)) = 1 AND min(s.kickoff_at) > e.verified_at));
CREATE VIEW public.core43_verified_shadow_inputs WITH (security_invoker=false) AS SELECT s.game_id,
    s.side,
    s.team_code,
    s.goalie_name,
    s.goalie_id,
    s.prediction_at,
    s.captured_at,
    s.gsax,
    s.shots_against,
    s.gsax_fetched_at,
        CASE
            WHEN v.ok THEN s.starter_status
            ELSE NULL::text
        END AS starter_status,
        CASE
            WHEN v.ok THEN s.starter_published_at
            ELSE NULL::timestamp with time zone
        END AS starter_published_at,
        CASE
            WHEN v.ok THEN s.starter_verified_at
            ELSE NULL::timestamp with time zone
        END AS starter_verified_at,
        CASE
            WHEN NOT v.ok AND (s.starter_status IS NOT NULL OR s.readiness = 'ready'::text) THEN 'missing_pregame_starter_evidence'::text
            ELSE s.readiness
        END AS readiness
   FROM nhl_core43_shadow_inputs s
     CROSS JOIN LATERAL ( SELECT (EXISTS ( SELECT
                   FROM core43_verified_starter_evidence e
                  WHERE e.game_id = s.game_id AND e.team_code = s.team_code AND e.goalie_id = s.goalie_id AND e.source_published_at = s.starter_published_at AND e.verified_at = s.starter_verified_at AND e.evidence_status = s.starter_status AND e.verified_at <= s.prediction_at)) AS ok) v;
INSERT INTO nhl_core43_schedule_snapshots VALUES (1,'2020-11-28 20:00Z','DAL','VGK'),(1,'2020-11-28 20:00Z','DAL','VGK'),(2,NULL,'DAL','VGK');
INSERT INTO nhl_prediction_archive VALUES (1,'2020-11-28','DAL','VGK','FINAL',3,2,'2020-11-28 19:00Z'),(2,'2020-11-28','DAL','VGK','FUT',NULL,2,'2020-11-28 19:00Z');
INSERT INTO nhl_core43_shadow_inputs VALUES
(1,'away','DAL','A','10','2020-11-28 19:00Z','2020-11-28 19:00Z',2,100,'2020-11-28 18:00Z','confirmed','2020-11-28 17:00Z','2020-11-28 18:00Z','ready'),
(1,'home','VGK','B','11','2020-11-28 19:00Z','2020-11-28 19:00Z',-1,100,'2020-11-28 18:00Z','confirmed','2020-11-28 17:00Z','2020-11-28 18:00Z','ready'),
(2,'away','DAL','C',NULL,'2020-11-28 19:00Z','2020-11-28 19:00Z',NULL,10,NULL,NULL,NULL,NULL,'missing');
INSERT INTO nhl_core43_starter_evidence VALUES
(1,1,'DAL','10','confirmed','rotowire','https://www.rotowire.com/hockey/headlines/a','2020-11-28 17:00Z','2020-11-28 18:00Z','2020-11-28 18:00Z','fixture',NULL,'2020-11-28 17:30Z'),
(2,1,'VGK','11','confirmed','rotowire','https://www.rotowire.com/hockey/headlines/b','2020-11-28 17:00Z','2020-11-28 18:00Z','2020-11-28 18:00Z','fixture',NULL,'2020-11-28 17:30Z'),
(3,1,'DAL','12','confirmed','rotowire','https://www.rotowire.com/hockey/headlines/c','2020-11-28 17:00Z','2020-11-28 21:00Z','2020-11-28 21:00Z','fixture',NULL,'2020-11-28 17:30Z');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM core43_verified_starter_evidence WHERE id=3) THEN RAISE EXCEPTION 'postgame evidence accepted'; END IF; IF (SELECT count(*) FROM core43_verified_starter_evidence WHERE id IN (1,2)) <> 2 THEN RAISE EXCEPTION 'valid evidence missing'; END IF; END $$;
ALTER TABLE nhl_core43_schedule_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_core43_shadow_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_core43_starter_evidence ENABLE ROW LEVEL SECURITY;
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
CREATE VIEW publication.source_core43_shadow_predictions_v1  AS WITH inputs AS (
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
CREATE VIEW publication.source_core43_shadow_preview_v1  AS WITH paired AS (
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
CREATE VIEW publication.source_nhl_core43_public_schedule_evidence WITH (security_barrier=true) AS SELECT DISTINCT game_id,
    kickoff_at,
    away_team,
    home_team
   FROM nhl_core43_schedule_snapshots
  WHERE game_id IS NOT NULL AND kickoff_at IS NOT NULL AND away_team IS NOT NULL AND home_team IS NOT NULL;
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

-- Refresh prototype: privileged transaction, no public execution grants.
CREATE PROCEDURE publication.refresh_all() LANGUAGE plpgsql SECURITY INVOKER AS $refresh$
BEGIN
  PERFORM pg_advisory_xact_lock(430453);
  LOCK TABLE public.nhl_core43_schedule_snapshots, public.nhl_core43_shadow_inputs, public.nhl_core43_starter_evidence, public.nhl_prediction_archive IN SHARE MODE;
  DELETE FROM publication.core43_shadow_predictions_v1;
  INSERT INTO publication.core43_shadow_predictions_v1 SELECT * FROM publication.source_core43_shadow_predictions_v1;
  DELETE FROM publication.core43_shadow_preview_v1;
  INSERT INTO publication.core43_shadow_preview_v1 SELECT * FROM publication.source_core43_shadow_preview_v1;
  DELETE FROM publication.nhl_core43_public_schedule_evidence;
  INSERT INTO publication.nhl_core43_public_schedule_evidence SELECT * FROM publication.source_nhl_core43_public_schedule_evidence;
END;
$refresh$;
REVOKE ALL ON PROCEDURE publication.refresh_all() FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN IF has_function_privilege('anon','publication.refresh_all()','EXECUTE') OR has_function_privilege('authenticated','publication.refresh_all()','EXECUTE') THEN RAISE EXCEPTION 'public refresh execution'; END IF; END $$;
-- Change the source and prove stale data is replaced, including deletions.
DELETE FROM nhl_core43_starter_evidence WHERE id=2;
INSERT INTO nhl_core43_schedule_snapshots VALUES (3,'2020-11-29 20:00Z','DAL','VGK');
CALL publication.refresh_all();
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM public.nhl_core43_public_schedule_evidence WHERE game_id=3) THEN RAISE EXCEPTION 'schedule refresh missing'; END IF;
IF EXISTS (SELECT 1 FROM public.core43_shadow_predictions_v1 WHERE game_id=1 AND experiment_status='experimental_ready') THEN RAISE EXCEPTION 'revoked evidence still published'; END IF;
IF EXISTS ((SELECT * FROM public.core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM publication.source_core43_shadow_predictions_v1) UNION ALL (SELECT * FROM publication.source_core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_predictions_v1)) THEN RAISE EXCEPTION 'refresh parity core43_shadow_predictions_v1'; END IF;
IF EXISTS ((SELECT * FROM public.core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM publication.source_core43_shadow_preview_v1) UNION ALL (SELECT * FROM publication.source_core43_shadow_preview_v1 EXCEPT ALL SELECT * FROM public.core43_shadow_preview_v1)) THEN RAISE EXCEPTION 'refresh parity core43_shadow_preview_v1'; END IF;
IF EXISTS ((SELECT * FROM public.nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM publication.source_nhl_core43_public_schedule_evidence) UNION ALL (SELECT * FROM publication.source_nhl_core43_public_schedule_evidence EXCEPT ALL SELECT * FROM public.nhl_core43_public_schedule_evidence)) THEN RAISE EXCEPTION 'refresh parity nhl_core43_public_schedule_evidence'; END IF;
END $$;
-- Inject a failure into the second projection; first projection must roll back too.
CREATE FUNCTION publication.fail_refresh() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected refresh failure'; END $$;
CREATE TRIGGER fail_refresh BEFORE INSERT ON publication.core43_shadow_preview_v1 FOR EACH STATEMENT EXECUTE FUNCTION publication.fail_refresh();
CREATE TEMP TABLE refresh_before AS SELECT * FROM public.core43_shadow_predictions_v1;
UPDATE nhl_prediction_archive SET core42_away=4 WHERE game_id=1;
DO $$ BEGIN
 BEGIN CALL publication.refresh_all(); RAISE EXCEPTION 'expected failure absent'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'injected refresh failure' THEN RAISE; END IF; END;
 IF EXISTS ((SELECT * FROM public.core43_shadow_predictions_v1 EXCEPT ALL SELECT * FROM refresh_before) UNION ALL (SELECT * FROM refresh_before EXCEPT ALL SELECT * FROM public.core43_shadow_predictions_v1)) THEN RAISE EXCEPTION 'partial refresh leaked'; END IF;
END $$;
DROP TRIGGER fail_refresh ON publication.core43_shadow_preview_v1;
CALL publication.refresh_all();
ROLLBACK;
