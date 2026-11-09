/* CORE 4.3 read-only pregame eligibility monitor.
 * Deliberately does not calculate goals or write a revision.
 */
"use strict";
const {proposeRevision}=require("../core43-revision-gate.js");
function evaluateCandidates({predictions=[],schedules=[],evidence=[],now}={}){
 if(typeof now!=="string"||!Number.isFinite(Date.parse(now)))throw Error("invalid_asof");
 const byGame=new Map(schedules.map(s=>[String(s.game_id),s]));
 return predictions.map(prediction=>{
  const schedule=byGame.get(String(prediction.game_id));
  if(!schedule)return {gameId:prediction.game_id,eligible:false,reason:"missing_schedule"};
  const decision=proposeRevision({prediction,schedule,evidence,asOf:now,model:"core41"});
  return {gameId:prediction.game_id,eligible:decision.eligible,reason:decision.reason,
   proposal:decision.eligible?decision.proposal:undefined};
 });
}
async function readTable(url,key,table,query,fetchImpl=fetch){
 const response=await fetchImpl(url+"/rest/v1/"+table+"?"+query,{headers:{apikey:key,Authorization:"Bearer "+key}});
 if(!response.ok)throw Error("read_failed_"+table+"_"+response.status);
 return response.json();
}
async function main(){
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error("missing_server_credentials");
 const now=new Date().toISOString();
 const [predictions,schedules,evidence]=await Promise.all([
  readTable(url,key,"nhl_prediction_archive","select=game_id,away_team,home_team,core41_predicted_at&core41_predicted_at=not.is.null&limit=1000"),
  readTable(url,key,"nhl_core43_schedule_snapshots","select=game_id,away_team,home_team,kickoff_at&kickoff_at=gt."+encodeURIComponent(now)+"&limit=1000"),
  readTable(url,key,"nhl_core43_starter_evidence","select=game_id,team_code,goalie_id,evidence_status,source_name,source_url,source_published_at,verified_at&verified_at=lte."+encodeURIComponent(now)+"&limit=1000")
 ]);
 const active=new Set(schedules.map(s=>String(s.game_id)));
 const results=evaluateCandidates({predictions:predictions.filter(p=>active.has(String(p.game_id))),schedules,evidence,now});
 console.log(JSON.stringify({asOf:now,mode:"read_only",scanned:results.length,eligible:results.filter(r=>r.eligible).length,
  results},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={evaluateCandidates,readTable};
