"use strict";
/* Read-only quality metrics. Source diversity is not proof of independence. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const valid=value=>typeof value==="string"&&Number.isFinite(Date.parse(value));
function auditEvidence({predictions=[],evidence=[]}={}){
 const sourceCounts={},byGame=new Map();
 let invalidChronology=0,missingTimestamp=0;
 for(const e of evidence){
  const source=String(e.source_name||"unknown").trim().toLowerCase();
  sourceCounts[source]=(sourceCounts[source]||0)+1;
  if(!valid(e.source_published_at)||!valid(e.verified_at)){missingTimestamp++;continue;}
  if(Date.parse(e.source_published_at)>Date.parse(e.verified_at)){invalidChronology++;continue;}
  const id=String(e.game_id);
  if(!byGame.has(id))byGame.set(id,[]);
  byGame.get(id).push(e);
 }
 let withPregameEvidence=0,withoutPregameEvidence=0,missingPredictionTime=0;
 for(const p of predictions){
  const at=p.core42_predicted_at||p.core41_predicted_at;
  if(!valid(at)){missingPredictionTime++;continue;}
  // Evaluate time separately; a URL must be HTTPS, never parsed as a date.
  const eligible=(byGame.get(String(p.game_id))||[]).some(e=>
   e.evidence_status==="confirmed"&&typeof e.source_url==="string"&&/^https:\/\//i.test(e.source_url)&&
   Date.parse(e.source_published_at)<=Date.parse(at)&&Date.parse(e.verified_at)<=Date.parse(at));
  if(eligible)withPregameEvidence++;else withoutPregameEvidence++;
 }
 return {mode:"read_only_shadow",totalEvidence:evidence.length,sourceCounts,
  uniqueSources:Object.keys(sourceCounts).length,invalidChronology,missingTimestamp,
  archivedGames:{total:predictions.length,withPregameEvidence,withoutPregameEvidence,missingPredictionTime},
  independentVerification:"not_established",production:false,persistable:false};
}
async function run({url,key,fetchImpl=fetch}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 const predictions=await fetchRows({url,key,table:"nhl_prediction_archive",select:"game_id,core41_predicted_at,core42_predicted_at",fetchImpl});
 const evidence=await fetchRows({url,key,table:"nhl_core43_starter_evidence",select:"game_id,evidence_status,source_name,source_url,source_published_at,verified_at",fetchImpl});
 return auditEvidence({predictions,evidence});
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
 .then(r=>console.log(JSON.stringify(r,null,2)))
 .catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={auditEvidence,run};
