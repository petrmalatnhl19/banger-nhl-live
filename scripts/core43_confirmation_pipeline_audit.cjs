"use strict";
/* Read-only audit of confirmation availability versus capture time. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const time=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const group=(rows)=>{const m=new Map();for(const row of rows){const k=String(row.game_id);if(!m.has(k))m.set(k,[]);m.get(k).push(row);}return m;};
function auditConfirmationPipeline({predictions=[],observations=[],evidence=[]}={}){
 const byObs=group(observations),byEvidence=group(evidence);
 const counts={missingPredictionTime:0,noConfirmedObservation:0,confirmedSeenBeforePrediction:0,
  confirmedFirstSeenAfterPrediction:0,confirmedSnapshotBeforeButObservedAfter:0,
  prePredictionConfirmedWithoutTimelyEvidence:0,confirmedWithTimelyEvidence:0};
 const games=[];
 for(const p of predictions){
  const id=String(p.game_id),at=time(p.core42_predicted_at||p.core41_predicted_at);
  if(at===null){counts.missingPredictionTime++;continue;}
  const confirmed=(byObs.get(id)||[]).filter(o=>String(o.observed_status).toLowerCase()==="confirmed"&&time(o.observed_at)!==null);
  const before=confirmed.filter(o=>time(o.observed_at)<=at&&time(o.source_snapshot_at)!==null&&time(o.source_snapshot_at)<=at);
  const late=confirmed.filter(o=>time(o.observed_at)>at);
  const snapshotEarlier=late.some(o=>time(o.source_snapshot_at)!==null&&time(o.source_snapshot_at)<=at);
  const timely=(byEvidence.get(id)||[]).some(e=>e.evidence_status==="confirmed"&&time(e.source_published_at)!==null&&
   time(e.verified_at)!==null&&time(e.source_published_at)<=at&&time(e.verified_at)<=at&&
   typeof e.source_url==="string"&&/^https:\/\//i.test(e.source_url));
  if(!confirmed.length)counts.noConfirmedObservation++;
  else if(before.length)counts.confirmedSeenBeforePrediction++;
  else counts.confirmedFirstSeenAfterPrediction++;
  if(snapshotEarlier)counts.confirmedSnapshotBeforeButObservedAfter++;
  if(before.length&&timely)counts.confirmedWithTimelyEvidence++;
  if(before.length&&!timely)counts.prePredictionConfirmedWithoutTimelyEvidence++;
  const first=confirmed.reduce((min,o)=>Math.min(min,time(o.observed_at)),Infinity);
  games.push({gameId:id,status:!confirmed.length?"no_confirmed_observation":before.length?"confirmed_before_prediction":"confirmed_after_prediction",
   firstConfirmedObservedDelayMinutes:Number.isFinite(first)?Math.round((first-at)/60000):null,
   snapshotEarlierThanPredictionButObservedLater:snapshotEarlier,timelyEvidence:timely});
 }
 return {mode:"read_only_shadow",totalArchivedGames:predictions.length,counts,games,
  notes:["Source snapshot time alone is not proof that our system knew the information.","A timely evidence row is not independent confirmation of both goalies.","Stored observations do not reveal the upstream polling schedule."],
  production:false,persistable:false};
}
async function run({url,key,fetchImpl=fetch}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 const defs={
  predictions:["nhl_prediction_archive","game_id,core41_predicted_at,core42_predicted_at"],
  observations:["nhl_core43_rotowire_observations","game_id,observed_status,observed_at,source_snapshot_at"],
  evidence:["nhl_core43_starter_evidence","game_id,evidence_status,source_url,source_published_at,verified_at"]};
 const data={};
 for(const [name,[table,select]] of Object.entries(defs))data[name]=await fetchRows({url,key,table,select,fetchImpl});
 return auditConfirmationPipeline(data);
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
 .then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={auditConfirmationPipeline,run};
