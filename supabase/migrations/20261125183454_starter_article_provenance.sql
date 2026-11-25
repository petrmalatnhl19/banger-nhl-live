-- Run atomically. Existing timestamps and frozen inputs remain immutable.
set local lock_timeout = '5s';
alter table public.nhl_core43_rotowire_observations
  add column article_published_at timestamptz, add column article_text text, add column article_goalie_id text;
alter table public.nhl_core43_starter_evidence
  add column article_text text, add column source_snapshot_at timestamptz, add column observed_at timestamptz;

-- Only the article and import independently verified against run 412.
-- Observation and snapshot clocks were not retained by that importer.
update public.nhl_core43_starter_evidence set article_text =
  'Tarasov will patrol the home crease against Vancouver on Wednesday, per Max Bultman of The Athletic.'
where id=1590740 and (game_id,team_code,goalie_id)=(2026020394,'DET','8480193')
  and source_published_at='2026-11-24T18:11:36Z' and verified_at='2026-11-25T03:46:06.178254Z'
  and source_url='https://www.rotowire.com/hockey/headlines/daniil-tarasov-news-tending-twine-wednesday-600965';

create view public.core43_verified_starter_evidence with (security_invoker=true) as
select e.* from public.nhl_core43_starter_evidence e
where nullif(btrim(e.article_text),'') is not null and e.evidence_status='confirmed'
  and e.source_url ~ '^https://[^/]+/.+' and e.goalie_id ~ '^[0-9]+$'
  and (lower(e.source_name)<>'rotowire' or e.source_url ~ '^https://(www[.])?rotowire[.]com/hockey/headlines/[^/?#]+$')
  and e.source_published_at <= e.verified_at and e.verified_at <= now()
  and (e.observed_at between e.source_published_at and e.verified_at
       or (e.id=1590740 and e.observed_at is null and e.source_snapshot_at is null))
  and (e.source_snapshot_at is null or e.source_snapshot_at between e.source_published_at and e.observed_at)
  and exists (select from public.nhl_core43_schedule_snapshots s where s.game_id=e.game_id
    group by s.game_id having bool_and(e.team_code in (s.away_team,s.home_team))
    and count(distinct (s.away_team,s.home_team,s.kickoff_at))=1 and min(s.kickoff_at)>e.verified_at);

-- Preserve the frozen records. A consumer may only use a frozen confirmation
-- whose exact identity and both clocks resolve to verified evidence as of prediction.
create view public.core43_verified_shadow_inputs with (security_invoker=true) as
select s.game_id,s.side,s.team_code,s.goalie_name,s.goalie_id,s.prediction_at,s.captured_at,
       s.gsax,s.shots_against,s.gsax_fetched_at,
       case when v.ok then s.starter_status end as starter_status,
       case when v.ok then s.starter_published_at end as starter_published_at,
       case when v.ok then s.starter_verified_at end as starter_verified_at,
       case when not v.ok and (s.starter_status is not null or s.readiness='ready')
            then 'missing_pregame_starter_evidence' else s.readiness end as readiness
from public.nhl_core43_shadow_inputs s cross join lateral (
  select exists (select from public.core43_verified_starter_evidence e where
    (e.game_id,e.team_code,e.goalie_id,e.source_published_at,e.verified_at,e.evidence_status)=
    (s.game_id,s.team_code,s.goalie_id,s.starter_published_at,s.starter_verified_at,s.starter_status)
    and e.verified_at<=s.prediction_at) as ok
) v;

revoke all on public.core43_verified_starter_evidence,public.core43_verified_shadow_inputs from public,anon,authenticated,service_role;
grant select on public.core43_verified_starter_evidence,public.core43_verified_shadow_inputs to service_role;

-- Job 6 still calls this entry point. Old observations cannot qualify.
create or replace function public.capture_core43_confirmed_evidence() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  verified timestamptz := statement_timestamp();
  inserted integer;
begin
  insert into public.nhl_core43_starter_evidence
    (game_id,team_code,goalie_id,evidence_status,source_name,source_url,source_published_at,
     verified_at,article_text,source_snapshot_at,observed_at)
  select distinct on (o.game_id,o.team_code,o.article_goalie_id,o.source_url,o.article_published_at)
    o.game_id,o.team_code,o.article_goalie_id,'confirmed','RotoWire',o.source_url,o.article_published_at,
    verified,o.article_text,o.source_snapshot_at,o.observed_at
  from public.nhl_core43_rotowire_observations o
  where o.observed_status='confirmed' and nullif(btrim(o.article_text),'') is not null
    and o.source_url ~ '^https://(www[.])?rotowire[.]com/hockey/headlines/[^/?#]+$'
    and o.article_published_at<=o.source_snapshot_at and o.source_snapshot_at<=o.observed_at
    and o.observed_at<=verified and o.article_goalie_id ~ '^[0-9]+$'
    and exists (select from public.nhl_core43_goalie_identity_map m where m.team_code=o.team_code
      and lower(btrim(m.goalie_name))=lower(btrim(o.goalie_name))
      having count(distinct m.goalie_id)=1 and min(m.goalie_id)=o.article_goalie_id)
    and exists (select from public.nhl_core43_schedule_snapshots s where s.game_id=o.game_id
      group by s.game_id having bool_and(o.team_code in(s.away_team,s.home_team))
      and count(distinct (s.away_team,s.home_team,s.kickoff_at))=1 and min(s.kickoff_at)>verified)
  order by o.game_id,o.team_code,o.article_goalie_id,o.source_url,o.article_published_at,o.observed_at
  on conflict(game_id,team_code,goalie_id,source_url,source_published_at) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end $$;
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
 left join lateral (select e.* from public.core43_verified_starter_evidence e where e.game_id=s.game_id and e.team_code=s.team_code and e.goalie_id=s.goalie_id and e.source_published_at<=s.prediction_at and e.verified_at<=s.prediction_at order by e.verified_at desc limit 1) e on true
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
do $rewire$
declare v record; original text;
begin
  for v in select * from (values
    ('core43_shadow_readiness_v1', 'FROM nhl_core43_starter_evidence ', 'FROM core43_verified_starter_evidence '),
    ('core43_goalie_experiment_inputs', 'WHERE ((r.game_id = s.game_id)', 'WHERE ((r.observed_status <> ''confirmed'' OR EXISTS (SELECT FROM public.core43_verified_starter_evidence ve JOIN public.nhl_core43_goalie_identity_map gm ON gm.goalie_id=ve.goalie_id AND gm.team_code=ve.team_code WHERE ve.game_id=r.game_id AND ve.team_code=r.team_code AND lower(btrim(gm.goalie_name))=lower(btrim(r.goalie_name)) AND ve.source_url=r.source_url AND ve.verified_at<=s.prediction_at)) AND (r.game_id = s.game_id)'),
    ('core43_confirmed_goalie_matchups', 'FROM nhl_core43_starter_evidence ', 'FROM core43_verified_starter_evidence '),
    ('core43_core42_comparison_readiness', 'WHERE ((o.game_id = s.game_id)', 'WHERE ((o.observed_status <> ''confirmed'' OR EXISTS (SELECT FROM public.core43_verified_starter_evidence ve JOIN public.nhl_core43_goalie_identity_map gm ON gm.goalie_id=ve.goalie_id AND gm.team_code=ve.team_code WHERE ve.game_id=o.game_id AND ve.team_code=o.team_code AND lower(btrim(gm.goalie_name))=lower(btrim(o.goalie_name)) AND ve.source_url=o.source_url AND ve.verified_at<=s.prediction_at)) AND (o.game_id = s.game_id)'),
    ('core43_shadow_predictions_v1', 'FROM nhl_core43_shadow_inputs
', 'FROM core43_verified_shadow_inputs nhl_core43_shadow_inputs
'),
    ('core43_shadow_preview_v1', 'FROM nhl_core43_shadow_inputs
', 'FROM core43_verified_shadow_inputs nhl_core43_shadow_inputs
')
  ) as changes(name,old_read,new_read) loop
    original := pg_get_viewdef(format('public.%I',v.name)::regclass,false);
    if strpos(original,v.old_read)=0 then raise exception 'Unexpected definition of %',v.name; end if;
    execute format('create or replace view public.%I %s as %s',v.name,
      coalesce((select 'with ('||array_to_string(reloptions,',')||')' from pg_class
                where oid=format('public.%I',v.name)::regclass),''),replace(original,v.old_read,v.new_read));
  end loop;
end $rewire$;
notify pgrst, 'reload schema';
