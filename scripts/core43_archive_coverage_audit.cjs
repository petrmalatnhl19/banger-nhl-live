"use strict";
/* Read-only coverage audit for frozen CORE 4.3 archive inputs. No backfills. */
const {reportFromRows}=require("./core43_supabase_readonly_report.cjs");
const valid=t=>typeof t==="string"&&Number.isFinite(Date.parse(t));
function auditArchive(data={}){
 const predictions=data.predictions||[],schedules=data.schedules||[];
 const missingPredictionTime=[],missingFrozenSchedule=[],usableFrozenSchedule=[];
 for(const p of predictions){
  const at=p.core42_predicted_at||p.core41_predicted_at;
  const id=String(p.game_id);
  if(!valid(at)){missingPredictionTime.push(id);continue;}
  const found=schedules.some(s=>String(s.game_id)===id&&s.away_team===p.away_team&&s.home_team===p.home_team&&
   valid(s.fetched_at)&&Date.parse(s.fetched_at)<=Date.parse(at)&&valid(s.kickoff_at)&&Date.parse(at)<Date.parse(s.kickoff_at));
  (found?usableFrozenSchedule:missingFrozenSchedule).push(id);
 }
 const report=reportFromRows(data);
 return {mode:"read_only_shadow",total:predictions.length,coverage:{
  missingPredictionTime:missingPredictionTime.length,
  missingFrozenSchedule:missingFrozenSchedule.length,
  usableFrozenSchedule:usableFrozenSchedule.length
 },gameIds:{missingPredictionTime,missingFrozenSchedule,usableFrozenSchedule},
 starterReadiness:report.counts,production:false,persistable:false};
}
module.exports={auditArchive};
