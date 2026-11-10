/* Read-only live Supabase source for experimental CORE 4.3 shadow computation.
 * No database writes, no invented missing goalie values.
 */
"use strict";
const {readTable}=require("./monitor_core43_revisions.cjs");
const {computeShadowCandidates}=require("./core43_shadow_compute.cjs");
async function readAllProvenance(base,key,table,columns,fetchImpl,{pageSize=500,maxRows=50000}={}){
 const rows=[];
 for(let offset=0;offset<=maxRows;offset+=pageSize){
  const page=await readTable(base,key,table,"select="+columns+"&limit="+pageSize+"&offset="+offset,fetchImpl);
  if(!Array.isArray(page)||page.length>pageSize)throw Error("invalid_provenance_page_"+table);
  if(rows.length+page.length>maxRows)throw Error("provenance_limit_exceeded_"+table);
  rows.push(...page);
  if(page.length<pageSize)return rows;
 }
 throw Error("provenance_limit_exceeded_"+table);
}
async function loadAndCompute({url,key,now=new Date().toISOString(),fetchImpl=fetch}={}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test((url||"").replace(/\/$/,""))||!key||!Number.isFinite(Date.parse(now)))throw Error("invalid_configuration");
 const base=url.replace(/\/$/,"");
 const [archive,schedules,shadowInputs,evidence,observations]=await Promise.all([
  readTable(base,key,"nhl_prediction_archive","select=game_id,away_team,home_team,core41_predicted_at,core41_away,core41_home&core41_predicted_at=not.is.null&limit=1000",fetchImpl),
  readTable(base,key,"nhl_core43_schedule_snapshots","select=game_id,away_team,home_team,kickoff_at&kickoff_at=gt."+encodeURIComponent(now)+"&limit=1000",fetchImpl),
  readTable(base,key,"nhl_core43_shadow_inputs","select=game_id,side,team_code,goalie_id,prediction_at,captured_at,gsax,shots_against,gsax_fetched_at,starter_status,starter_published_at,starter_verified_at,readiness&prediction_at=lte."+encodeURIComponent(now)+"&limit=1000",fetchImpl),
  readAllProvenance(base,key,"nhl_core43_starter_evidence","game_id,team_code,goalie_id,source_name,source_published_at",fetchImpl),
  readAllProvenance(base,key,"nhl_core43_rotowire_observations","game_id,team_code,source_snapshot_at",fetchImpl)
 ]);
 const future=new Set(schedules.map(s=>String(s.game_id)));
 const snapshotKeys=new Set(observations.map(o=>[String(o.game_id),o.team_code,o.source_snapshot_at].join("|")));
 const suspectStarterKeys=evidence.filter(e=>e.source_name==="RotoWire"&&snapshotKeys.has([String(e.game_id),e.team_code,e.source_published_at].join("|"))).map(e=>[String(e.game_id),e.team_code,String(e.goalie_id),e.source_published_at].join("|"));
 const results=computeShadowCandidates({archive:archive.filter(a=>future.has(String(a.game_id))),schedules,shadowInputs,suspectStarterKeys});
 return {mode:"read_only",asOf:now,archiveRows:archive.length,scheduleRows:schedules.length,inputRows:shadowInputs.length,suspectLegacyEvidence:suspectStarterKeys.length,
  scanned:results.length,available:results.filter(r=>r.available).length,results};
}
async function main(){
 const report=await loadAndCompute({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
 console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={loadAndCompute,readAllProvenance};
