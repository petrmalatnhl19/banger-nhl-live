"use strict";
/* Prospective V2 dry-run: read-only, no archive writes or historical backfill. */
const {run:monitor}=require("./core43_scheduled_pregame_monitor.cjs");
const {inspectLiveShadowGame}=require("./core43_live_shadow_source_reader.cjs");
const {VERSION,hashRecord}=require("./core43_json_canonicalization.cjs");
async function run({url,key,now=new Date().toISOString(),fetchImpl=fetch,monitorImpl=monitor,inspectImpl=inspectLiveShadowGame}={}){
 if(!key)throw Error("missing_server_credentials");
 const readiness=await monitorImpl({url,key,now,fetchImpl});
 const games=[];
 for(const g of readiness.results||[]){
  if(!g.ready){games.push({gameId:g.gameId,awayTeam:g.awayTeam,homeTeam:g.homeTeam,ready:false,reason:g.reason});continue;}
  const capture=await inspectImpl({url,key,gameId:g.gameId,awayTeam:g.awayTeam,homeTeam:g.homeTeam,asOf:now,now,fetchImpl});
  if(!capture.captured){games.push({gameId:g.gameId,ready:false,reason:capture.reason||"capture_unavailable"});continue;}
  if(capture.record?.serializationVersion!==VERSION||capture.sha256!==hashRecord(capture.record))throw Error("v2_integrity_mismatch");
  games.push({gameId:g.gameId,awayTeam:g.awayTeam,homeTeam:g.homeTeam,ready:true,serializationVersion:VERSION,sha256:capture.sha256});
 }
 return {mode:"v2_read_only_dry_run",generatedAt:now,serializationVersion:VERSION,checked:games.length,ready:games.filter(g=>g.ready).length,archived:0,writesEnabled:false,games};
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY})
 .then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
