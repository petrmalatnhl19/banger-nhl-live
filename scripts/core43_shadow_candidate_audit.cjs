/* CORE 4.3 experimental shadow candidate audit.
 * Read-only: this is NOT a forecast generator and NEVER writes to Supabase.
 * Only accepts two distinct pregame goalie snapshots with complete identities.
 */
"use strict";
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
const validNumber=x=>typeof x==="number"&&Number.isFinite(x);
function auditShadowCandidates({archive=[],schedules=[],shadowInputs=[]}={}){
 const schedulesById=new Map(),conflicts=new Set();
 for(const s of schedules){
  const id=String(s.game_id),old=schedulesById.get(id);
  if(!validTime(s.kickoff_at))continue;
  if(old&&(old.kickoff_at!==s.kickoff_at||old.away_team!==s.away_team||old.home_team!==s.home_team))conflicts.add(id);
  else schedulesById.set(id,s);
 }
 return archive.filter(a=>validTime(a.core41_predicted_at)).map(a=>{
  const id=String(a.game_id),s=schedulesById.get(id);
  const fail=reason=>({gameId:a.game_id,ready:false,reason});
  if(!s)return fail("missing_schedule");
  if(conflicts.has(id))return fail("conflicting_schedule");
  if(s.away_team!==a.away_team||s.home_team!==a.home_team)return fail("team_mismatch");
  const predicted=Date.parse(a.core41_predicted_at),kickoff=Date.parse(s.kickoff_at);
  if(predicted>=kickoff)return fail("original_not_pregame");
  if(![a.core41_away,a.core41_home].every(v=>validNumber(v)&&v>=0&&v<=20))return fail("missing_core41_baseline");
  const inputs=shadowInputs.filter(x=>String(x.game_id)===id);
  const sides={};
  for(const side of ["away","home"]){
   const rows=inputs.filter(x=>x.side===side&&x.team_code===s[side+"_team"]);
   if(rows.length!==1)return fail("missing_or_ambiguous_"+side+"_input");
   const x=rows[0];
   if(x.readiness!=="ready"||!x.goalie_id||x.starter_status!=="confirmed")return fail("unverified_"+side+"_starter");
   if(![x.prediction_at,x.captured_at,x.gsax_fetched_at,x.starter_published_at,x.starter_verified_at].every(validTime))return fail("missing_"+side+"_timestamps");
   const at=Date.parse(x.prediction_at);
   if(at<=predicted||at>=kickoff||[x.captured_at,x.gsax_fetched_at,x.starter_published_at,x.starter_verified_at].some(t=>Date.parse(t)>at))return fail("late_"+side+"_evidence");
   if(!validNumber(x.gsax)||!Number.isInteger(x.shots_against)||x.shots_against<30)return fail("missing_"+side+"_gsax");
   sides[side]={goalieId:String(x.goalie_id),gsax:x.gsax,shots:x.shots_against,asOf:x.prediction_at};
  }
  if(sides.away.asOf!==sides.home.asOf)return fail("different_prediction_times");
  if(sides.away.goalieId===sides.home.goalieId)return fail("duplicate_goalie_identity");
  return {gameId:a.game_id,ready:true,reason:null,asOf:sides.away.asOf,
   baseline:{away:a.core41_away,home:a.core41_home,predictedAt:a.core41_predicted_at},goalies:sides,
   note:"Inputs only; no calibrated prediction or database write"};
 });
}
module.exports={auditShadowCandidates};
