/* RotoWire observational coverage diagnostic; never promotes to verified starter evidence.
 * Observations lack independently sourced publication timestamps and frozen NHL goalie IDs.
 */
"use strict";
const {readTable}=require("./monitor_core43_revisions.cjs");
function auditRotoWire({observations=[],schedules=[],asOf}={}){
 const time=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
 if(!time(asOf))throw Error("invalid_asof");
 const scheduleByGame=new Map(),conflicts=new Set();
 for(const s of schedules){
  const id=String(s.game_id),prev=scheduleByGame.get(id);
  if(prev&&(prev.away_team!==s.away_team||prev.home_team!==s.home_team||prev.kickoff_at!==s.kickoff_at))conflicts.add(id);
  else scheduleByGame.set(id,s);
 }
 const pairs=new Map();
 for(const o of observations){
  if(o.observed_status!=="confirmed")continue;
  const id=String(o.game_id),s=scheduleByGame.get(id);
  if(!s||conflicts.has(id)||!time(s.kickoff_at)||![s.away_team,s.home_team].includes(o.team_code))continue;
  if(!time(o.observed_at)||!time(o.source_snapshot_at)||Date.parse(o.source_snapshot_at)>Date.parse(o.observed_at)||Date.parse(o.observed_at)>Date.parse(asOf)||Date.parse(o.observed_at)>=Date.parse(s.kickoff_at))continue;
  const key=id+":"+o.team_code;
  if(!pairs.has(key))pairs.set(key,{gameId:o.game_id,teamCode:o.team_code,names:new Set(),observations:0});
  const pair=pairs.get(key);
  pair.names.add(String(o.goalie_name||"").trim().toLowerCase());
  pair.observations++;
 }
 const results=[...pairs.values()].map(p=>({gameId:p.gameId,teamCode:p.teamCode,observations:p.observations,
  distinctGoalieNames:p.names.size,reason:p.names.size===1?"observation_only_missing_source_publication_and_frozen_goalie_id":"conflicting_goalie_names",eligibleForPromotion:false}));
 return {mode:"read_only",asOf,confirmedObservations:observations.filter(o=>o.observed_status==="confirmed").length,
  matchedPregamePairs:results.length,results};
}
async function main(){
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error("missing_server_credentials");
 const asOf=new Date().toISOString();
 const [observations,schedules]=await Promise.all([
  readTable(url,key,"nhl_core43_rotowire_observations","select=game_id,team_code,goalie_name,observed_status,observed_at,source_snapshot_at&observed_status=eq.confirmed&limit=1000"),
  readTable(url,key,"nhl_core43_schedule_snapshots","select=game_id,away_team,home_team,kickoff_at&limit=1000")
 ]);
 console.log(JSON.stringify(auditRotoWire({observations,schedules,asOf}),null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={auditRotoWire};
