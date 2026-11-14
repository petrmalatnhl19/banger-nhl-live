"use strict";
/* CORE43-CAL-04 scheduled diagnostic only: GET requests, stdout report, no archive writes. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const {discoverUpcomingGames}=require("./core43_scheduled_pregame_monitor.cjs");
const {loadLiveShadowSources}=require("./core43_live_shadow_source_reader.cjs");
const {adaptArchivedGsaxSnapshots}=require("./core43_archived_gsax_snapshot_adapter.cjs");
const {assemblePregameSourceInput}=require("./core43_pregame_source_assembly.cjs");
const {plan}=require("./core43_cal03_capture_plan.cjs");
const fs=require("node:fs");
function summarize({now,games,existing=[]}={}){
 const rows=[],seen=new Set(existing);
 for(const game of games){
  if(!game.baselineReady){rows.push({gameId:game.gameId,status:"skipped",reason:game.reason});continue;}
  const p=plan({payload:game.payload,provenance:game.provenance,now,existing:[...seen]});
  if(p.ready)for(const v of p.variants)seen.add(v.key);
  rows.push({gameId:game.gameId,status:p.ready?(p.uniqueVariants?"ready":"duplicate"):"skipped",
   reason:p.reason||null,windowMinutes:p.windowMinutes||null,
   variants:p.ready?p.variants.map(v=>({coefficient:v.record.coefficient,key:v.key,sha256:v.sha256,duplicate:v.duplicate,
    away:v.record.away,home:v.record.home})):[],production:false,archived:false});
 }
 return {schema:"core43_cal04_dryrun_report_v1",mode:"read_only",generatedAt:now,
  checked:rows.length,ready:rows.filter(x=>x.status==="ready").length,
  duplicates:rows.filter(x=>x.status==="duplicate").length,
  skipped:rows.filter(x=>x.status==="skipped").length,
  databaseWrites:0,production:false,results:rows};
}
async function run({url,key,now=new Date().toISOString(),fetchImpl=fetch,existingKeys}={}){
 if(!key)throw Error("missing_server_credentials");
 const [schedules,predictions]=await Promise.all([
  fetchRows({url,key,table:"nhl_core43_schedule_snapshots",select:"game_id,away_team,home_team,kickoff_at,fetched_at",fetchImpl}),
  fetchRows({url,key,table:"nhl_prediction_archive",select:"game_id,away_team,home_team,core42_predicted_at,core42_away,core42_home",fetchImpl})
 ]);
 const upcoming=discoverUpcomingGames({schedules,predictions,now,horizonMinutes:75})
  .filter(g=>Date.parse(g.kickoffAt)-Date.parse(now)>=45*60000);
 const games=[];
 for(const game of upcoming){
  if(!game.baselineReady){games.push(game);continue;}
  try{
   const sources=await loadLiveShadowSources({url,key,gameId:game.gameId,fetchImpl});
   const adapted=adaptArchivedGsaxSnapshots(sources.goalieSnapshotRows,{asOf:now});
   if(!adapted.ready){games.push({...game,baselineReady:false,reason:adapted.reason});continue;}
   const assembly=assemblePregameSourceInput({...sources,gsaxSnapshots:adapted.snapshots,gameId:game.gameId,awayTeam:game.awayTeam,
    homeTeam:game.homeTeam,asOf:now,now});
   if(!assembly.ready){games.push({...game,baselineReady:false,reason:assembly.reason});continue;}
   games.push({...game,payload:assembly.payload,provenance:assembly.provenance});
  }catch(e){games.push({...game,baselineReady:false,reason:"source_read_failed"});}
 }
 const ledgerPath=process.env.CORE43_CAL04_LEDGER_PATH;
 let existing=existingKeys===undefined?[]:existingKeys;
 if(!Array.isArray(existing)||existing.some(k=>typeof k!=="string"))throw Error("invalid_existing_keys");
 if(existingKeys===undefined&&ledgerPath&&fs.existsSync(ledgerPath)){
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
  if(!ledger||!Array.isArray(ledger.keys)||ledger.keys.some(k=>typeof k!=="string"))throw Error("invalid_readonly_ledger");
  existing=ledger.keys;
 }
 const report=summarize({now,games,existing});
 return {...report,ledger:{schema:"core43_cal04_keys_v1",keys:[...new Set([...existing,...report.results.flatMap(g=>g.variants.filter(v=>!v.duplicate).map(v=>v.key))])]}};
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY})
 .then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={summarize,run};
