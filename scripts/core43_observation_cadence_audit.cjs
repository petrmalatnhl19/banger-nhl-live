"use strict";
/* Diagnose existing observation cadence before introducing another scheduler. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const stamp=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
function auditCadence({observations=[],schedules=[]}={}){
 const byGame=new Map(),kickoffs=new Map();
 for(const s of schedules){const t=stamp(s.kickoff_at);if(t!==null){const id=String(s.game_id);if(!kickoffs.has(id)||stamp(s.fetched_at)>stamp(kickoffs.get(id).fetched_at||""))kickoffs.set(id,s);}}
 for(const o of observations){const t=stamp(o.observed_at),snap=stamp(o.source_snapshot_at);
  if(t===null||snap===null)continue;
  const id=String(o.game_id);if(!byGame.has(id))byGame.set(id,new Map());
  const key=String(o.team_code||"unknown");if(!byGame.get(id).has(key))byGame.get(id).set(key,new Set());
  byGame.get(id).get(key).add(Math.max(t,snap));
 }
 const gaps=[],byWindow={last6h:0,last3h:0,last1h:0},gamesWithoutKickoff=[];
 for(const [id,teams] of byGame){
  const kickoff=stamp(kickoffs.get(id)?.kickoff_at);
  if(kickoff===null){gamesWithoutKickoff.push(id);continue;}
  for(const [team,values] of teams){
   const times=[...values].filter(t=>t<=kickoff).sort((a,b)=>a-b);
   for(let i=1;i<times.length;i++){const gap=(times[i]-times[i-1])/60000;
    if(times[i]>=kickoff-6*3600000)gaps.push({gameId:id,teamCode:team,gapMinutes:Math.round(gap)});
   }
   if(times.some(t=>t>=kickoff-6*3600000))byWindow.last6h++;
   if(times.some(t=>t>=kickoff-3*3600000))byWindow.last3h++;
   if(times.some(t=>t>=kickoff-3600000))byWindow.last1h++;
  }
 }
 const sorted=gaps.map(x=>x.gapMinutes).sort((a,b)=>a-b);
 return {mode:"read_only_shadow",observations:observations.length,gameTeamSeries:[...byGame.values()].reduce((n,v)=>n+v.size,0),
  gameTeamSeriesWithObservationsByWindow:byWindow,gamesWithoutKickoff,
  gapSamplesLast6h:sorted.length,medianGapMinutes:sorted.length?sorted[Math.floor((sorted.length-1)/2)]:null,
  p90GapMinutes:sorted.length?sorted[Math.ceil(sorted.length*.9)-1]:null,
  largestGaps:gaps.sort((a,b)=>b.gapMinutes-a.gapMinutes).slice(0,20),
  interpretation:"observed ingestion timestamps, not a verified upstream polling schedule",
  production:false,persistable:false};
}
async function run({url,key,fetchImpl=fetch}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 const observations=await fetchRows({url,key,table:"nhl_core43_rotowire_observations",select:"game_id,team_code,observed_at,source_snapshot_at",fetchImpl});
 const schedules=await fetchRows({url,key,table:"nhl_core43_schedule_snapshots",select:"game_id,kickoff_at,fetched_at",fetchImpl});
 return auditCadence({observations,schedules});
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
 .then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={auditCadence,run};
