/* Read-only empirical reliability audit for frozen goalie projections.
 * No probability is assigned without sufficient historical observations.
 * This is descriptive in-sample evidence, not a calibrated live model.
 */
"use strict";
const {evaluateGoalieAccuracy}=require("./core43_goalie_accuracy_evaluation.cjs");
const time=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const buckets=[["under_2h",0,2],["2_to_6h",2,6],["6_to_24h",6,24],["over_24h",24,Infinity]];
function evaluateProjectedReliability(rows=[],{minSample=30}={}){
 if(!Array.isArray(rows)||!Number.isSafeInteger(minSample)||minSample<30)
  throw new TypeError("Invalid reliability audit inputs");
 const byBucket={};const excluded={};let eligible=0;
 // One frozen pick per game/team/lead-time bucket. Duplicate records cannot inflate sample size.
 const unique=new Map(),conflicted=new Set();
 for(const row of rows){
  if(!row||row.predictionStatus!=="projected")continue;
  const kickoff=time(row.kickoffAt),observed=time(row.predictedAt);
  if(!Number.isFinite(kickoff)||!Number.isFinite(observed))continue;
  const hours=(kickoff-observed)/3600000;
  const bucket=buckets.find(([,min,max])=>hours>=min&&hours<max)?.[0];
  if(!bucket)continue;
  const key=JSON.stringify([row.gameId,row.teamCode,bucket]);
  if(row.gameId==null||typeof row.teamCode!=="string"||!row.teamCode)continue;
  if(unique.has(key))conflicted.add(key);
  else unique.set(key,row);
 }
 for(const [name] of buckets)byBucket[name]={evaluated:0,correct:0,incorrect:0,observedAccuracy:null,usableAsProbability:false};
 for(const row of rows){
  const reject=reason=>{excluded[reason]=(excluded[reason]||0)+1;};
  if(!row||row.predictionStatus!=="projected"){reject("not_projected");continue;}
  const kickoff=time(row.kickoffAt),observed=time(row.predictedAt),actual=time(row.actualVerifiedAt);
  if(![kickoff,observed,actual].every(Number.isFinite)||observed>=kickoff||actual<kickoff){reject("invalid_timing");continue;}
  const evaluation=evaluateGoalieAccuracy([row]);
  if(evaluation.evaluated!==1){reject(Object.keys(evaluation.excluded)[0]||"invalid_evidence");continue;}
  const hours=(kickoff-observed)/3600000;
  const name=buckets.find(([,min,max])=>hours>=min&&hours<max)?.[0];
  if(!name){reject("invalid_lead_time");continue;}
  const key=JSON.stringify([row.gameId,row.teamCode,name]);
  if(row.gameId==null||typeof row.teamCode!=="string"||!row.teamCode){reject("missing_identity");continue;}
  if(conflicted.has(key)){reject("duplicate_or_conflicting_pick");continue;}
  eligible++;
  const bucket=byBucket[name];bucket.evaluated++;
  if(evaluation.correct)bucket.correct++;else bucket.incorrect++;
 }
 for(const bucket of Object.values(byBucket)){
  bucket.observedAccuracy=bucket.evaluated>=minSample?bucket.correct/bucket.evaluated:null;
 }
 return {mode:"read_only",model:"core43_projected_reliability_audit_v0",
  eligible,excluded,byLeadTime:byBucket,
  calibrated:false,production:false,persistable:false,
  warning:"Historical descriptive accuracy only; no live start probabilities or model calibration."};
}
module.exports={evaluateProjectedReliability};
