"use strict";
/* Read-only timing audit; historical timestamps are never reconstructed. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const ms=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
function auditTiming({predictions=[],observations=[],evidence=[]}={}){
 const byGame=new Map(),evidenceByGame=new Map();
 for(const o of observations){const id=String(o.game_id);if(!byGame.has(id))byGame.set(id,[]);byGame.get(id).push(o);}
 for(const e of evidence){const id=String(e.game_id);if(!evidenceByGame.has(id))evidenceByGame.set(id,[]);evidenceByGame.get(id).push(e);}
 const counts={missingPredictionTime:0,noPregameObservation:0,pregameProjectedOnly:0,pregameObservedConfirmed:0,
  evidencePublishedAfterPrediction:0,evidenceVerifiedAfterPrediction:0,missingEvidenceTimestamps:0,
  evidenceReadyBeforePrediction:0,missingEvidence:0};
 const games=[];
 for(const p of predictions){
  const id=String(p.game_id),at=ms(p.core42_predicted_at||p.core41_predicted_at);
  if(at===null){counts.missingPredictionTime++;games.push({gameId:id,status:"missing_prediction_time"});continue;}
  const before=(byGame.get(id)||[]).filter(o=>{const observed=ms(o.observed_at),snapshot=ms(o.source_snapshot_at);return observed!==null&&snapshot!==null&&observed<=at&&snapshot<=at;});
  const hasConfirmed=before.some(o=>String(o.observed_status).toLowerCase()==="confirmed");
  if(!before.length)counts.noPregameObservation++;
  else if(hasConfirmed)counts.pregameObservedConfirmed++;
  else counts.pregameProjectedOnly++;
  const records=(evidenceByGame.get(id)||[]).filter(e=>e.evidence_status==="confirmed");
  let evidenceStatus="missing_evidence";
  if(!records.length)counts.missingEvidence++;
  else{
   const complete=records.filter(e=>ms(e.source_published_at)!==null&&ms(e.verified_at)!==null);
   if(complete.length!==records.length)counts.missingEvidenceTimestamps++;
   if(complete.some(e=>ms(e.source_published_at)>at))counts.evidencePublishedAfterPrediction++;
   if(complete.some(e=>ms(e.verified_at)>at))counts.evidenceVerifiedAfterPrediction++;
   if(complete.some(e=>ms(e.source_published_at)<=at&&ms(e.verified_at)<=at&&
     typeof e.source_url==="string"&&/^https:\/\//i.test(e.source_url))){
    counts.evidenceReadyBeforePrediction++;evidenceStatus="evidence_before_prediction";
   }else evidenceStatus="no_timely_evidence";
  }
  const latest=before.reduce((max,o)=>Math.max(max,ms(o.observed_at)||0),0);
  games.push({gameId:id,observationStatus:!before.length?"no_pregame_observation":hasConfirmed?"pregame_observed_confirmed":"pregame_projected_only",
   latestObservationAgeMinutes:latest?Math.round((at-latest)/60000):null,evidenceStatus});
 }
 return {mode:"read_only_shadow",total:predictions.length,counts,games,independentVerification:"not_established",production:false,persistable:false};
}
async function run({url,key,fetchImpl=fetch}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 const definitions={
  predictions:["nhl_prediction_archive","game_id,core41_predicted_at,core42_predicted_at"],
  observations:["nhl_core43_rotowire_observations","game_id,observed_at,source_snapshot_at,observed_status"],
  evidence:["nhl_core43_starter_evidence","game_id,evidence_status,source_url,source_published_at,verified_at"]};
 const data={};
 for(const [alias,[table,select]] of Object.entries(definitions))data[alias]=await fetchRows({url,key,table,select,fetchImpl});
 return auditTiming(data);
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
 .then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={auditTiming,run};
