"use strict";
/* Compare only independently frozen, pre-kickoff forecasts with verified finals. */
const time=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const goals=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=20;
function evaluateFrozenShadowOutcomes(rows=[]){
 const excluded={},accepted=[];
 const skip=r=>{excluded[r]=(excluded[r]||0)+1;};
 for(const row of rows){
  if(!row||!row.actual||row.actual.status!=="verified_final"||!Number.isInteger(row.actual.away)||!Number.isInteger(row.actual.home)||![row.actual.away,row.actual.home].every(goals)){skip("missing_verified_final");continue;}
  const kickoff=time(row.kickoffAt),finalAt=time(row.actual.verifiedAt);
  if(!Number.isFinite(kickoff)||!Number.isFinite(finalAt)||finalAt<kickoff){skip("invalid_final_timing");continue;}
  const models=[["core41",row.core41],["core42",row.core42],["core43",row.core43]];
  if(models.some(([,x])=>!x||!goals(x.away)||!goals(x.home)||!Number.isFinite(time(x.predictedAt))||time(x.predictedAt)>=kickoff)){skip("missing_or_late_paired_forecast");continue;}
  const shadow=row.core43;
  if(shadow.production!==false||shadow.persistable!==false||shadow.calibrated!==false||shadow.experimental!==true||shadow.frozenBeforeKickoff!==true||!Number.isFinite(time(shadow.frozenAt))||time(shadow.frozenAt)>=kickoff||time(shadow.frozenAt)<time(shadow.predictedAt)){skip("unverified_shadow_freeze");continue;}
  if(shadow.inputAsOf!==shadow.predictedAt||time(shadow.inputAsOf)>time(shadow.frozenAt)){skip("shadow_input_time_mismatch");continue;}
  const scores={};
  for(const [name,x] of models){
   const mae=(Math.abs(x.away-row.actual.away)+Math.abs(x.home-row.actual.home))/2;
   const mse=((x.away-row.actual.away)**2+(x.home-row.actual.home)**2)/2;
   const winner=x.away===x.home?null:(x.away>x.home)===(row.actual.away>row.actual.home);
   scores[name]={mae,mse,winner};
  }
  accepted.push({gameId:row.gameId,scores});
 }
 const n=accepted.length;
 const metrics={};
 for(const name of ["core41","core42","core43"]){
  const values=accepted.map(r=>r.scores[name]),called=values.filter(x=>x.winner!==null);
  metrics[name]={games:n,goalsMAE:n?values.reduce((s,x)=>s+x.mae,0)/n:null,
   goalsRMSE:n?Math.sqrt(values.reduce((s,x)=>s+x.mse,0)/n):null,
   winnerCalls:called.length,correctWinners:called.filter(x=>x.winner).length,
   winnerAccuracy:called.length?called.filter(x=>x.winner).length/called.length:null};
 }
 return {mode:"read_only",production:false,persistable:false,pairedGames:n,excluded,metrics,
  differences:{core43Vs41MAE:n?metrics.core41.goalsMAE-metrics.core43.goalsMAE:null,core43Vs42MAE:n?metrics.core42.goalsMAE-metrics.core43.goalsMAE:null},
  conclusion:n<30?"insufficient_paired_sample_no_accuracy_claim":"descriptive_only_requires_out_of_sample_validation",
  note:"Requires independently recorded pregame shadow freeze. Never reconstruct CORE 4.3 from postgame data."};
}
module.exports={evaluateFrozenShadowOutcomes};
