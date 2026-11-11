"use strict";
/* Manual prospective pilot only. Scheduled automatic writes remain disabled. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const {discoverUpcomingGames}=require("./core43_scheduled_pregame_monitor.cjs");
const {inspectLiveShadowGame}=require("./core43_live_shadow_source_reader.cjs");
const {insertOnce}=require("./core43_append_only_capture_writer.cjs");
const {explain}=require("./core43_pilot_readiness_explainer.cjs");
async function pilot({url,key,gameId,enabled=false,now=()=>new Date().toISOString(),fetchImpl=fetch}={}){
 if(!/^\d+$/.test(String(gameId??"")))throw Error("invalid_game_id");
 if(!key)throw Error("missing_server_credentials");
 const timestamp=now();
 const [schedules,predictions]=await Promise.all([
  fetchRows({url,key,table:"nhl_core43_schedule_snapshots",select:"game_id,away_team,home_team,kickoff_at,fetched_at",gameId:String(gameId),fetchImpl}),
  fetchRows({url,key,table:"nhl_prediction_archive",select:"game_id,away_team,home_team,core42_predicted_at,core42_away,core42_home",gameId:String(gameId),fetchImpl})
 ]);
 const matches=discoverUpcomingGames({schedules,predictions,now:timestamp,horizonMinutes:180}).filter(g=>g.gameId===String(gameId));
 if(matches.length!==1||!matches[0].baselineReady){
  const diagnostics=await explain({url,key,gameId,now:timestamp,fetchImpl});
  return {inserted:false,reason:matches[0]?.reason||"no_upcoming_baseline_ready_game",mode:"manual_pilot",diagnostics};
 }
 const game=matches[0];
 const result=await inspectLiveShadowGame({url,key,gameId:game.gameId,awayTeam:game.awayTeam,homeTeam:game.homeTeam,asOf:timestamp,now:timestamp,fetchImpl});
 if(!result.captured)return {inserted:false,reason:result.reason,mode:"manual_pilot"};
 if(!enabled)return {inserted:false,reason:"dry_run_ready",mode:"manual_pilot",captureSha256:result.sha256};
 // Recheck wall clock immediately before the only allowed write.
 const writeTime=now();
 if(Date.parse(writeTime)>=Date.parse(game.kickoffAt)||Date.parse(writeTime)-Date.parse(timestamp)>60000)throw Error("stale_or_started_game");
 const saved=await insertOnce({url,key,result,now:writeTime,enabled:true,fetchImpl});
 return {...saved,mode:"manual_pilot",gameId:game.gameId};
}
if(require.main===module)pilot({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,gameId:process.env.CORE43_PILOT_GAME_ID,enabled:process.env.CORE43_PILOT_WRITE==="I_CONFIRM_EXPERIMENTAL_INSERT"}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={pilot};
