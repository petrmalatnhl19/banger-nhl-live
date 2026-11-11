"use strict";
/* Scheduled read-only pregame readiness. Never writes or claims a frozen forecast. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const {inspectLiveShadowGame}=require("./core43_live_shadow_source_reader.cjs");
const valid=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function discoverUpcomingGames({schedules=[],predictions=[],now,horizonMinutes=180}={}){
 if(!valid(now)||!Number.isInteger(horizonMinutes)||horizonMinutes<1||horizonMinutes>360)throw Error("invalid_window");
 const start=Date.parse(now),byId=new Map();
 for(const s of schedules){
  if(!s||!/^\d+$/.test(String(s.game_id))||!valid(s.kickoff_at)||!valid(s.fetched_at)||Date.parse(s.fetched_at)>start||Date.parse(s.kickoff_at)<=start||Date.parse(s.kickoff_at)>start+horizonMinutes*60000)continue;
  const key=String(s.game_id),prev=byId.get(key);
  if(!prev||Date.parse(prev.fetched_at)<Date.parse(s.fetched_at))byId.set(key,s);
 }
 const predicted=new Map(predictions.filter(p=>p&&p.game_id!=null).map(p=>[String(p.game_id),p]));
 return [...byId.values()].sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).map(s=>{
  const p=predicted.get(String(s.game_id));
  const ready=!!p&&p.away_team===s.away_team&&p.home_team===s.home_team&&valid(p.core42_predicted_at)&&Date.parse(p.core42_predicted_at)<=start&&Date.parse(p.core42_predicted_at)<Date.parse(s.kickoff_at)&&typeof p.core42_away==="number"&&typeof p.core42_home==="number";
  return {gameId:String(s.game_id),awayTeam:s.away_team,homeTeam:s.home_team,kickoffAt:s.kickoff_at,baselineReady:ready,reason:ready?null:"missing_valid_core42_baseline"};
 });
}
async function run({url,key,now=new Date().toISOString(),fetchImpl=fetch}={}){
 if(!key)throw Error("missing_server_credentials");
 const [schedules,predictions]=await Promise.all([
  fetchRows({url,key,table:"nhl_core43_schedule_snapshots",select:"game_id,away_team,home_team,kickoff_at,fetched_at",fetchImpl}),
  fetchRows({url,key,table:"nhl_prediction_archive",select:"game_id,away_team,home_team,core42_predicted_at,core42_away,core42_home",fetchImpl})
 ]);
 const games=discoverUpcomingGames({schedules,predictions,now});
 const results=[];
 for(const game of games){
  if(!game.baselineReady){results.push({...game,ready:false,reason:game.reason});continue;}
  // asOf is NOW for a prospective experimental calculation, not a historical forecast timestamp.
  const result=await inspectLiveShadowGame({url,key,gameId:game.gameId,awayTeam:game.awayTeam,homeTeam:game.homeTeam,asOf:now,now,fetchImpl});
  results.push({...game,ready:result.captured===true,reason:result.reason||null,experimental:true,archived:false});
 }
 return {mode:"read_only_pregame_monitor",generatedAt:now,checked:results.length,ready:results.filter(r=>r.ready).length,archived:0,results};
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY})
 .then(r=>console.log(JSON.stringify(r,null,2)))
 .catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={discoverUpcomingGames,run};
