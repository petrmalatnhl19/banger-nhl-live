"use strict";
/* Read-only, fail-closed join. Caller must supply independently verified actual starter records.
 * No assumption that existing prediction archive stores frozen goalie IDs.
 */
const {evaluateGoalieAccuracy}=require("./core43_goalie_accuracy_evaluation.cjs");
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function joinGoalieArchive({predictions=[],schedules=[],actualStarters=[]}={}){
 const scheduleMap=new Map(),badSchedule=new Set(),actualMap=new Map(),badActual=new Set();
 for(const s of schedules){
  if(!s||!validTime(s.kickoff_at))continue;
  const k=String(s.game_id),old=scheduleMap.get(k);
  if(old&&(old.kickoff_at!==s.kickoff_at||old.away_team!==s.away_team||old.home_team!==s.home_team))badSchedule.add(k);
  else scheduleMap.set(k,s);
 }
 for(const a of actualStarters){
  if(!a||a.status!=="verified"||!validTime(a.verified_at)||!a.goalie_id)continue;
  const k=String(a.game_id)+"|"+a.team_code,old=actualMap.get(k);
  if(old&&String(old.goalie_id)!==String(a.goalie_id))badActual.add(k);
  else actualMap.set(k,a);
 }
 const rows=[],excluded={};
 const skip=k=>excluded[k]=(excluded[k]||0)+1;
 const seen=new Set();
 for(const p of predictions){
  if(!p){skip("invalid_prediction");continue;}
  const gameKey=String(p.game_id),key=gameKey+"|"+p.team_code;
  if(seen.has(key)){skip("duplicate_prediction");continue;}
  seen.add(key);
  const s=scheduleMap.get(gameKey);
  if(!s||badSchedule.has(gameKey)||![s.away_team,s.home_team].includes(p.team_code)){skip("missing_or_conflicting_schedule");continue;}
  if(!validTime(p.predicted_at)||Date.parse(p.predicted_at)>=Date.parse(s.kickoff_at)){skip("not_frozen_pregame");continue;}
  if(p.prediction_status!=="confirmed"&&p.prediction_status!=="projected"){skip("not_a_usable_prediction");continue;}
  if(badActual.has(key)){skip("conflicting_actual_starters");continue;}
  const a=actualMap.get(key);
  if(!a){skip("missing_verified_actual");continue;}
  rows.push({gameId:p.game_id,teamCode:p.team_code,kickoffAt:s.kickoff_at,predictedAt:p.predicted_at,actualVerifiedAt:a.verified_at,predictedGoalieId:p.goalie_id,actualStarterGoalieId:a.goalie_id,actualSourceStatus:"verified",predictionStatus:p.prediction_status});
 }
 const overall=evaluateGoalieAccuracy(rows);
 const byStatus={};
 for(const status of ["confirmed","projected"])byStatus[status]=evaluateGoalieAccuracy(rows.filter(r=>r.predictionStatus===status));
 return {mode:"read_only",inputPredictions:predictions.length,joined:rows.length,excludedAtJoin:excluded,overall,byStatus};
}
module.exports={joinGoalieArchive};
