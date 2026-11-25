-- Restore original readers and function bodies atomically. Keep all source records,
-- new metadata and compatibility views. Leave the unsafe legacy cron paused.
set local lock_timeout='5s';
select cron.alter_job(jobid,active:=false) from cron.job where jobname='banger-core43-starter-evidence';
CREATE OR REPLACE FUNCTION public.capture_core43_confirmed_evidence()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
 with unique_map as (
 select team_code,lower(btrim(goalie_name)) norm_name,min(goalie_id) goalie_id
 from public.nhl_core43_goalie_identity_map
 group by team_code,lower(btrim(goalie_name))
 having count(distinct goalie_id)=1
 ), confirmed as (
 select distinct on(o.game_id,o.team_code,m.goalie_id,o.source_snapshot_at)
 o.game_id,o.team_code,m.goalie_id,o.source_url,o.source_snapshot_at,o.observed_at
 from public.nhl_core43_rotowire_observations o
 join unique_map m on m.team_code=o.team_code and m.norm_name=lower(btrim(o.goalie_name))
 join lateral (select s.kickoff_at,s.away_team,s.home_team from public.nhl_core43_schedule_snapshots s where s.game_id=o.game_id order by s.fetched_at desc limit 1) sch on true
 where o.observed_status='confirmed' and o.source_snapshot_at is not null and o.observed_at is not null
 and o.source_snapshot_at<=o.observed_at and o.observed_at<sch.kickoff_at
 and o.team_code in (sch.away_team,sch.home_team) and o.observed_at<=now()
 order by o.game_id,o.team_code,m.goalie_id,o.source_snapshot_at,o.observed_at
 ), inserted as (
 insert into public.nhl_core43_starter_evidence(game_id,team_code,goalie_id,evidence_status,source_name,source_url,source_published_at,verified_at)
 select game_id,team_code,goalie_id,'confirmed','RotoWire',source_url,source_snapshot_at,observed_at from confirmed
 on conflict do nothing returning 1
 )
 select count(*) into n from inserted;
 return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.capture_core43_shadow_inputs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare inserted integer;
begin
 with sides as (
  select a.game_id,a.core42_predicted_at prediction_at,'away'::text side,a.away_team team_code,a.core42_factors->'away_goalie'->>'name' goalie_name,a.core42_factors->'away_goalie'->>'nhl_player_id' goalie_id
  from public.nhl_prediction_archive a where a.core42_predicted_at >= '2026-11-08 00:00:00+00'::timestamptz and a.core42_predicted_at <= now() and a.core42_predicted_at is not null
  union all
  select a.game_id,a.core42_predicted_at,'home',a.home_team,a.core42_factors->'home_goalie'->>'name',a.core42_factors->'home_goalie'->>'nhl_player_id'
  from public.nhl_prediction_archive a where a.core42_predicted_at >= '2026-11-08 00:00:00+00'::timestamptz and a.core42_predicted_at <= now() and a.core42_predicted_at is not null
 ), sources as (
 select s.*,g.gsax,g.shots_against,g.fetched_at gsax_fetched_at,e.evidence_status,e.source_published_at,e.verified_at
 from sides s
 left join lateral (select g.* from public.nhl_core43_goalie_snapshots g where g.goalie_id=s.goalie_id and g.team_code=s.team_code and g.situation='all' and g.fetched_at<=s.prediction_at order by g.fetched_at desc limit 1) g on true
 left join lateral (select e.* from public.nhl_core43_starter_evidence e where e.game_id=s.game_id and e.team_code=s.team_code and e.goalie_id=s.goalie_id and e.source_published_at<=s.prediction_at and e.verified_at<=s.prediction_at order by e.verified_at desc limit 1) e on true
 ), saved as (
 insert into public.nhl_core43_shadow_inputs(game_id,side,team_code,goalie_name,goalie_id,prediction_at,gsax,shots_against,gsax_fetched_at,starter_status,starter_published_at,starter_verified_at,readiness)
 select game_id,side,team_code,goalie_name,goalie_id,prediction_at,gsax,shots_against,gsax_fetched_at,evidence_status,source_published_at,verified_at,
 case when goalie_id is null then 'missing_frozen_goalie_id'
 when evidence_status is null then 'missing_pregame_starter_evidence'
 when lower(evidence_status) not in ('confirmed','starting','confirmed_starter') then 'starter_not_confirmed'
 when gsax_fetched_at is null then 'missing_pregame_gsax_snapshot'
 when shots_against is null or shots_against<30 then 'insufficient_shots'
 when gsax is null then 'missing_gsax'
 else 'ready' end
 from sources
 on conflict (game_id,side) do nothing returning 1
 )
 select count(*) into inserted from saved;
 return inserted;
end $function$
;
create or replace view public.core43_shadow_readiness_v1 as
 WITH sides AS (
         SELECT a.game_id,
            a.game_date,
            a.core42_predicted_at AS prediction_at,
            'away'::text AS side,
            a.away_team AS team_code,
            ((a.core42_factors -> 'away_goalie'::text) ->> 'name'::text) AS goalie_name,
            ((a.core42_factors -> 'away_goalie'::text) ->> 'nhl_player_id'::text) AS goalie_id
           FROM nhl_prediction_archive a
          WHERE (a.core42_predicted_at IS NOT NULL)
        UNION ALL
         SELECT a.game_id,
            a.game_date,
            a.core42_predicted_at,
            'home'::text,
            a.home_team,
            ((a.core42_factors -> 'home_goalie'::text) ->> 'name'::text),
            ((a.core42_factors -> 'home_goalie'::text) ->> 'nhl_player_id'::text)
           FROM nhl_prediction_archive a
          WHERE (a.core42_predicted_at IS NOT NULL)
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
           FROM ((sides s
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
                  WHERE ((e_1.game_id = s.game_id) AND (e_1.team_code = s.team_code) AND (e_1.goalie_id = s.goalie_id) AND (e_1.source_published_at <= s.prediction_at) AND (e_1.verified_at <= s.prediction_at))
                  ORDER BY e_1.verified_at DESC
                 LIMIT 1) e ON (true))
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
                  WHERE ((g_1.goalie_id = s.goalie_id) AND (g_1.team_code = s.team_code) AND (g_1.situation = 'all'::text) AND (g_1.fetched_at <= s.prediction_at))
                  ORDER BY g_1.fetched_at DESC
                 LIMIT 1) g ON (true))
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
            WHEN (goalie_id IS NULL) THEN 'missing_frozen_goalie_id'::text
            WHEN (evidence_status IS NULL) THEN 'missing_pregame_starter_evidence'::text
            WHEN (lower(evidence_status) <> ALL (ARRAY['confirmed'::text, 'starting'::text, 'confirmed_starter'::text])) THEN 'starter_not_confirmed'::text
            WHEN (gsax_fetched_at IS NULL) THEN 'missing_pregame_gsax_snapshot'::text
            WHEN ((shots_against IS NULL) OR (shots_against < 30)) THEN 'insufficient_shots'::text
            WHEN (gsax IS NULL) THEN 'missing_gsax'::text
            ELSE 'ready'::text
        END AS readiness
   FROM evidence;
create or replace view public.core43_goalie_experiment_inputs with (security_invoker=true) as
 WITH sides AS (
         SELECT m.game_id,
            m.kickoff_at,
            m.core41_predicted_at AS prediction_at,
            'away'::text AS side,
            m.away_team AS team_code
           FROM core43_matchup_inputs m
        UNION ALL
         SELECT m.game_id,
            m.kickoff_at,
            m.core41_predicted_at,
            'home'::text AS text,
            m.home_team
           FROM core43_matchup_inputs m
        )
 SELECT s.game_id,
    s.side,
    s.team_code,
    s.kickoff_at,
    s.prediction_at,
    o.goalie_name,
    o.observed_status,
    o.observed_at AS starter_observed_at,
    o.source_snapshot_at,
        CASE
            WHEN (ids.candidates = 1) THEN ids.goalie_id
            ELSE NULL::text
        END AS goalie_id,
    g.gsax,
    g.shots_against,
    g.fetched_at AS gsax_fetched_at,
        CASE
            WHEN (s.prediction_at IS NULL) THEN 'missing_prediction_timestamp'::text
            WHEN (s.prediction_at >= s.kickoff_at) THEN 'prediction_not_pregame'::text
            WHEN (o.game_id IS NULL) THEN 'no_starter_observed_before_prediction'::text
            WHEN (o.observed_status <> 'confirmed'::text) THEN 'starter_not_confirmed'::text
            WHEN (ids.candidates IS DISTINCT FROM 1) THEN 'goalie_identity_unresolved'::text
            WHEN (g.goalie_id IS NULL) THEN 'no_historical_gsax_before_prediction'::text
            ELSE 'research_only_observed_confirmed'::text
        END AS readiness
   FROM (((sides s
     LEFT JOIN LATERAL ( SELECT r.game_id,
            r.goalie_name,
            r.observed_status,
            r.observed_at,
            r.source_snapshot_at
           FROM nhl_core43_rotowire_observations r
          WHERE ((r.game_id = s.game_id) AND (r.team_code = s.team_code) AND (s.prediction_at IS NOT NULL) AND (r.observed_at <= s.prediction_at) AND (r.observed_at < s.kickoff_at) AND (r.source_snapshot_at <= r.observed_at))
          ORDER BY r.observed_at DESC
         LIMIT 1) o ON (true))
     LEFT JOIN LATERAL ( SELECT min(i.goalie_id) AS goalie_id,
            count(DISTINCT i.goalie_id) AS candidates
           FROM nhl_core43_goalie_identity_map i
          WHERE ((i.team_code = s.team_code) AND (i.normalized_name = lower(regexp_replace(TRIM(BOTH FROM o.goalie_name), '\s+'::text, ' '::text, 'g'::text))))) ids ON (true))
     LEFT JOIN LATERAL ( SELECT x.goalie_id,
            x.gsax,
            x.shots_against,
            x.fetched_at
           FROM nhl_core43_goalie_snapshots x
          WHERE ((x.goalie_id = ids.goalie_id) AND (ids.candidates = 1) AND (x.team_code = s.team_code) AND (x.shots_against >= 30) AND (x.fetched_at < s.prediction_at) AND (x.fetched_at < s.kickoff_at))
          ORDER BY x.fetched_at DESC, x.id DESC
         LIMIT 1) g ON (true));
create or replace view public.core43_confirmed_goalie_matchups with (security_invoker=true) as
 SELECT m.game_id,
    m.away_team,
    m.home_team,
    m.kickoff_at,
    ea.goalie_id AS away_goalie_id,
    eh.goalie_id AS home_goalie_id,
    ga.gsax AS away_gsax,
    gh.gsax AS home_gsax,
    ga.gsax_per_100_shots AS away_gsax_per_100,
    gh.gsax_per_100_shots AS home_gsax_per_100,
    ga.fetched_at AS away_snapshot_at,
    gh.fetched_at AS home_snapshot_at,
        CASE
            WHEN (m.readiness <> 'awaiting_confirmed_starters'::text) THEN m.readiness
            WHEN ((ea.goalie_id IS NULL) OR (eh.goalie_id IS NULL)) THEN 'awaiting_confirmed_starters'::text
            WHEN ((ga.goalie_id IS NULL) OR (gh.goalie_id IS NULL)) THEN 'missing_pregame_gsax'::text
            ELSE 'ready_for_experimental_core43'::text
        END AS readiness
   FROM ((((core43_matchup_inputs m
     LEFT JOIN LATERAL ( SELECT e.goalie_id,
            e.verified_at
           FROM nhl_core43_starter_evidence e
          WHERE ((e.game_id = m.game_id) AND (e.team_code = m.away_team) AND (e.evidence_status = 'confirmed'::text) AND (e.verified_at < m.kickoff_at) AND (e.source_published_at < m.kickoff_at))
          ORDER BY e.verified_at DESC, e.id DESC
         LIMIT 1) ea ON (true))
     LEFT JOIN LATERAL ( SELECT e.goalie_id,
            e.verified_at
           FROM nhl_core43_starter_evidence e
          WHERE ((e.game_id = m.game_id) AND (e.team_code = m.home_team) AND (e.evidence_status = 'confirmed'::text) AND (e.verified_at < m.kickoff_at) AND (e.source_published_at < m.kickoff_at))
          ORDER BY e.verified_at DESC, e.id DESC
         LIMIT 1) eh ON (true))
     LEFT JOIN LATERAL ( SELECT g.goalie_id,
            g.gsax,
            round(((g.gsax * (100)::numeric) / (NULLIF(g.shots_against, 0))::numeric), 2) AS gsax_per_100_shots,
            g.fetched_at
           FROM nhl_core43_goalie_snapshots g
          WHERE ((g.goalie_id = ea.goalie_id) AND (g.team_code = m.away_team) AND (g.shots_against >= 30) AND (g.fetched_at < m.kickoff_at) AND (g.fetched_at <= ea.verified_at))
          ORDER BY g.fetched_at DESC, g.id DESC
         LIMIT 1) ga ON (true))
     LEFT JOIN LATERAL ( SELECT g.goalie_id,
            g.gsax,
            round(((g.gsax * (100)::numeric) / (NULLIF(g.shots_against, 0))::numeric), 2) AS gsax_per_100_shots,
            g.fetched_at
           FROM nhl_core43_goalie_snapshots g
          WHERE ((g.goalie_id = eh.goalie_id) AND (g.team_code = m.home_team) AND (g.shots_against >= 30) AND (g.fetched_at < m.kickoff_at) AND (g.fetched_at <= eh.verified_at))
          ORDER BY g.fetched_at DESC, g.id DESC
         LIMIT 1) gh ON (true));
create or replace view public.core43_core42_comparison_readiness with (security_invoker=true) as
 WITH sides AS (
         SELECT p.game_id,
            p.core42_predicted_at AS prediction_at,
            s_1.kickoff_at,
            'away'::text AS side,
            p.away_team AS team_code
           FROM (nhl_prediction_archive p
             JOIN LATERAL ( SELECT s_2.kickoff_at
                   FROM nhl_core43_schedule_snapshots s_2
                  WHERE (s_2.game_id = p.game_id)
                  ORDER BY s_2.fetched_at DESC
                 LIMIT 1) s_1 ON (true))
          WHERE (p.core42_predicted_at IS NOT NULL)
        UNION ALL
         SELECT p.game_id,
            p.core42_predicted_at,
            s_1.kickoff_at,
            'home'::text AS text,
            p.home_team
           FROM (nhl_prediction_archive p
             JOIN LATERAL ( SELECT s_2.kickoff_at
                   FROM nhl_core43_schedule_snapshots s_2
                  WHERE (s_2.game_id = p.game_id)
                  ORDER BY s_2.fetched_at DESC
                 LIMIT 1) s_1 ON (true))
          WHERE (p.core42_predicted_at IS NOT NULL)
        )
 SELECT s.game_id,
    s.side,
    s.team_code,
    s.prediction_at,
    s.kickoff_at,
    r.goalie_name,
    r.observed_status,
    r.observed_at,
    r.source_snapshot_at,
        CASE
            WHEN (ids.n = 1) THEN ids.goalie_id
            ELSE NULL::text
        END AS goalie_id,
    g.gsax,
    g.shots_against,
    g.fetched_at AS gsax_fetched_at,
        CASE
            WHEN (s.prediction_at >= s.kickoff_at) THEN 'prediction_not_pregame'::text
            WHEN (r.game_id IS NULL) THEN 'no_observation_at_prediction'::text
            WHEN (r.observed_status <> 'confirmed'::text) THEN 'not_confirmed'::text
            WHEN (ids.n IS DISTINCT FROM 1) THEN 'identity_unresolved'::text
            WHEN (g.goalie_id IS NULL) THEN 'no_gsax_at_prediction'::text
            ELSE 'research_ready_unverified_publication'::text
        END AS readiness
   FROM (((sides s
     LEFT JOIN LATERAL ( SELECT o.game_id,
            o.goalie_name,
            o.observed_status,
            o.observed_at,
            o.source_snapshot_at
           FROM nhl_core43_rotowire_observations o
          WHERE ((o.game_id = s.game_id) AND (o.team_code = s.team_code) AND (o.observed_at <= s.prediction_at) AND (o.observed_at < s.kickoff_at) AND (o.source_snapshot_at <= o.observed_at))
          ORDER BY o.observed_at DESC
         LIMIT 1) r ON (true))
     LEFT JOIN LATERAL ( SELECT min(i.goalie_id) AS goalie_id,
            count(DISTINCT i.goalie_id) AS n
           FROM nhl_core43_goalie_identity_map i
          WHERE ((i.team_code = s.team_code) AND (i.normalized_name = lower(regexp_replace(TRIM(BOTH FROM r.goalie_name), '\s+'::text, ' '::text, 'g'::text))))) ids ON (true))
     LEFT JOIN LATERAL ( SELECT x.goalie_id,
            x.gsax,
            x.shots_against,
            x.fetched_at
           FROM nhl_core43_goalie_snapshots x
          WHERE ((x.goalie_id = ids.goalie_id) AND (ids.n = 1) AND (x.team_code = s.team_code) AND (x.shots_against >= 30) AND (x.fetched_at < s.prediction_at) AND (x.fetched_at < s.kickoff_at))
          ORDER BY x.fetched_at DESC, x.id DESC
         LIMIT 1) g ON (true));
create or replace view public.core43_shadow_predictions_v1 as
 WITH inputs AS (
         SELECT nhl_core43_shadow_inputs.game_id,
            max(((nhl_core43_shadow_inputs.gsax * 100.0) / (NULLIF(nhl_core43_shadow_inputs.shots_against, 0))::numeric)) FILTER (WHERE (nhl_core43_shadow_inputs.side = 'away'::text)) AS away_gsax_per100,
            max(((nhl_core43_shadow_inputs.gsax * 100.0) / (NULLIF(nhl_core43_shadow_inputs.shots_against, 0))::numeric)) FILTER (WHERE (nhl_core43_shadow_inputs.side = 'home'::text)) AS home_gsax_per100,
            count(*) FILTER (WHERE (nhl_core43_shadow_inputs.readiness = 'ready'::text)) AS ready_sides,
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
            WHEN ((i.ready_sides = 2) AND (i.total_sides = 2) AND (a.core42_away IS NOT NULL) AND (a.core42_home IS NOT NULL)) THEN round((GREATEST((0.4)::double precision, LEAST((6.0)::double precision, (a.core42_away + (GREATEST('-0.3'::numeric, LEAST(0.3, ((i.away_gsax_per100 - i.home_gsax_per100) * 0.06))))::double precision))))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_away,
        CASE
            WHEN ((i.ready_sides = 2) AND (i.total_sides = 2) AND (a.core42_away IS NOT NULL) AND (a.core42_home IS NOT NULL)) THEN round((GREATEST((0.4)::double precision, LEAST((6.0)::double precision, (a.core42_home + (GREATEST('-0.3'::numeric, LEAST(0.3, ((i.home_gsax_per100 - i.away_gsax_per100) * 0.06))))::double precision))))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_home,
        CASE
            WHEN ((i.ready_sides = 2) AND (i.total_sides = 2)) THEN 'experimental_ready'::text
            ELSE 'awaiting_verified_pregame_inputs'::text
        END AS experiment_status,
    'core43-shadow-gsax-v1-heuristic-unvalidated'::text AS model_version
   FROM (nhl_prediction_archive a
     JOIN inputs i USING (game_id))
  WHERE (a.core42_predicted_at IS NOT NULL);
create or replace view public.core43_shadow_preview_v1 as
 WITH paired AS (
         SELECT nhl_core43_shadow_inputs.game_id,
            count(*) AS sides,
            count(*) FILTER (WHERE ((nhl_core43_shadow_inputs.goalie_id IS NOT NULL) AND (nhl_core43_shadow_inputs.gsax IS NOT NULL) AND (nhl_core43_shadow_inputs.shots_against >= 30) AND (nhl_core43_shadow_inputs.gsax_fetched_at <= nhl_core43_shadow_inputs.prediction_at))) AS valid_gsax_sides,
            max(((nhl_core43_shadow_inputs.gsax * 100.0) / (NULLIF(nhl_core43_shadow_inputs.shots_against, 0))::numeric)) FILTER (WHERE (nhl_core43_shadow_inputs.side = 'away'::text)) AS away_gsax_per100,
            max(((nhl_core43_shadow_inputs.gsax * 100.0) / (NULLIF(nhl_core43_shadow_inputs.shots_against, 0))::numeric)) FILTER (WHERE (nhl_core43_shadow_inputs.side = 'home'::text)) AS home_gsax_per100,
            count(*) FILTER (WHERE (nhl_core43_shadow_inputs.starter_status = 'confirmed'::text)) AS confirmed_sides
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
            WHEN ((p.sides = 2) AND (p.valid_gsax_sides = 2) AND (a.core42_away IS NOT NULL)) THEN round((GREATEST((0.4)::double precision, LEAST((6.0)::double precision, (a.core42_away + (GREATEST('-0.3'::numeric, LEAST(0.3, ((p.away_gsax_per100 - p.home_gsax_per100) * 0.06))))::double precision))))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_preview_away,
        CASE
            WHEN ((p.sides = 2) AND (p.valid_gsax_sides = 2) AND (a.core42_home IS NOT NULL)) THEN round((GREATEST((0.4)::double precision, LEAST((6.0)::double precision, (a.core42_home + (GREATEST('-0.3'::numeric, LEAST(0.3, ((p.home_gsax_per100 - p.away_gsax_per100) * 0.06))))::double precision))))::numeric, 3)
            ELSE NULL::numeric
        END AS core43_preview_home,
        CASE
            WHEN ((p.sides = 2) AND (p.valid_gsax_sides = 2)) THEN 'provisional_goalies_not_confirmed'::text
            ELSE 'missing_pregame_gsax'::text
        END AS preview_status,
    'core43-gsax-preview-v1-unvalidated'::text AS version
   FROM (nhl_prediction_archive a
     JOIN paired p USING (game_id))
  WHERE (a.core42_predicted_at IS NOT NULL);
notify pgrst, 'reload schema';
