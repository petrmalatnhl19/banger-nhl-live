"use strict";
/* CORE 4.3 read-only end-to-end readiness report. Never recomputes historical inputs. */
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
const finite=x=>typeof x==="number"&&Number.isFinite(x);
function inspectGame({prediction,schedule,goalies=[],gsax=[],fatigue=[],absences=[]}={}){
 const fail=reason=>({available:false,reason,production:false,persistable:false});
 if(!prediction||!schedule||String(prediction.game_id)!==String(schedule.game_id))
  return fail("missing_or_mismatched_game");
 const kickoff=schedule.kickoff_at,asOf=prediction.core42_predicted_at||prediction.core41_predicted_at;
 if(!validTime(kickoff)||!validTime(asOf)||Date.parse(asOf)>=Date.parse(kickoff))
  return fail("invalid_frozen_prediction_time");
 if(prediction.away_team!==schedule.away_team||prediction.home_team!==schedule.home_team)
  return fail("team_mismatch");
 const sides=["away","home"],out={};
 for(const side of sides){
  const team=schedule[side+"_team"];
  const candidates=goalies.filter(x=>x.team_code===team&&String(x.game_id)===String(prediction.game_id)&&
   validTime(x.observed_at)&&Date.parse(x.observed_at)<=Date.parse(asOf));
  candidates.sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at));
  const g=candidates[0],conflict=g&&candidates.some(x=>x.observed_at===g.observed_at&&
    (x.goalie_name!==g.goalie_name||x.observed_status!==g.observed_status));
  const goalie=conflict?{status:"unavailable",reason:"conflicting_observations"}:g?
   {status:g.observed_status==="confirmed"?"observed_confirmed_label":g.observed_status==="projected"?"projected":"unavailable",
    name:g.goalie_name||null,observedAt:g.observed_at,
    sourcePublicationVerified:false,
    reason:"archive_observation_is_not_publication_evidence"}:
   {status:"unavailable",reason:"no_frozen_goalie_observation"};
  const one=(rows,type)=>{
   const found=rows.filter(x=>x.team_code===team&&String(x.game_id)===String(prediction.game_id));
   if(found.length!==1)return {available:false,reason:found.length?"ambiguous_"+type:"missing_"+type};
   const r=found[0];
   if(!validTime(r.fetched_at)||Date.parse(r.fetched_at)>Date.parse(asOf))
    return {available:false,reason:"late_or_invalid_"+type+"_snapshot"};
   if(type==="gsax"&&(!finite(r.gsax_per_100_shots)||!Number.isInteger(r.shots_against)||r.shots_against<30))
    return {available:false,reason:"invalid_gsax_sample"};
   if(type==="fatigue"&&(!finite(r.hours_between_starts)||r.hours_between_starts<0))
    return {available:false,reason:"invalid_fatigue_sample"};
   if(type==="absences"&&(!Array.isArray(r.verified_player_ids)||!r.verified_player_ids.every(id=>typeof id==="string")))
    return {available:false,reason:"invalid_absence_evidence"};
   return {available:true,asOf:r.fetched_at,metric:type==="gsax"?{gsaxPer100Shots:r.gsax_per_100_shots,shotsAgainst:r.shots_against}:type==="fatigue"?{hoursBetweenStarts:r.hours_between_starts,exactRestHours:null}:{verifiedPlayerIds:r.verified_player_ids}};
  };
  out[side]={team,goalie,gsax:one(gsax,"gsax"),fatigue:one(fatigue,"fatigue"),absences:one(absences,"absences")};
 }
 return {available:true,gameId:String(prediction.game_id),kickoffUTC:kickoff,frozenPredictionAt:asOf,
  frozenModel:prediction.core42_predicted_at?"core42":"core41",
  sides:out,readyForCalibratedForecast:false,production:false,persistable:false,
  warning:"Diagnostic only. Observed goalie labels are not publication-verified confirmations. Missing pregame snapshots must not be backfilled."};
}
module.exports={inspectGame};
