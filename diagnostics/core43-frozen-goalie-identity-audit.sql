-- CORE 4.3 read-only frozen goalie identity audit.
-- This is diagnostic only: never backfill historical shadow inputs.
-- A name/team identity match is not evidence of a confirmed pregame starter.
with missing as (
 select s.game_id,s.side,s.team_code,s.goalie_name,s.prediction_at,s.readiness
 from public.nhl_core43_shadow_inputs s
 where s.goalie_id is null
), matches as (
 select s.game_id,s.side,s.team_code,s.goalie_name,s.prediction_at,s.readiness,
        count(distinct m.goalie_id) as matching_goalie_ids,
        count(distinct m.goalie_id) filter (where m.observed_at<=s.prediction_at) as pregame_observed_goalie_ids
 from missing s
 left join public.nhl_core43_goalie_identity_map m
   on m.team_code=s.team_code
  and m.normalized_name=lower(trim(regexp_replace(s.goalie_name,'\\s+',' ','g')))
 group by s.game_id,s.side,s.team_code,s.goalie_name,s.prediction_at,s.readiness
)
select game_id,side,team_code,goalie_name,prediction_at,readiness,
       matching_goalie_ids,pregame_observed_goalie_ids,
       case when pregame_observed_goalie_ids=1 then 'identity_available_before_prediction'
            when matching_goalie_ids=1 then 'identity_only_observed_after_prediction'
            when matching_goalie_ids=0 then 'no_identity_match'
            else 'ambiguous_identity_match' end as diagnostic
from matches
order by game_id,side;
