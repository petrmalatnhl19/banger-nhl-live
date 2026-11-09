/* Read-only goalie evidence coverage audit. Never guesses or backfills a starter. */
"use strict";
const {readTable}=require("./monitor_core43_revisions.cjs");
function auditCoverage({schedules=[],evidence=[],now}={}){
 if(!Number.isFinite(Date.parse(now)))throw Error("invalid_asof");
 const byGame=new Map(),conflicts=new Set();
 for(const s of schedules){
  if(!Number.isFinite(Date.parse(s.kickoff_at))||Date.parse(s.kickoff_at)<=Date.parse(now))continue;
  const id=String(s.game_id),old=byGame.get(id);
  if(old&&(old.kickoff_at!==s.kickoff_at||old.away_team!==s.away_team||old.home_team!==s.home_team))conflicts.add(id);
  else byGame.set(id,s);
 }
 const results=[];
 for(const [id,s] of byGame){
  if(conflicts.has(id)){results.push({gameId:id,ready:false,reason:"conflicting_schedule"});continue;}
  const teams={};
  for(const team of [s.away_team,s.home_team]){
   const valid=evidence.filter(e=>String(e.game_id)===id&&e.team_code===team&&e.evidence_status==="confirmed"&&/^\d+$/.test(String(e.goalie_id||""))&&/^https:\/\//.test(e.source_url||"")&&typeof e.source_name==="string"&&e.source_name.trim().length>=3&&Number.isFinite(Date.parse(e.source_published_at))&&Number.isFinite(Date.parse(e.verified_at))&&Date.parse(e.source_published_at)<=Date.parse(e.verified_at)&&Date.parse(e.verified_at)<=Date.parse(now)&&Date.parse(e.verified_at)<Date.parse(s.kickoff_at));
   const identities=new Set(valid.map(e=>String(e.goalie_id)));
   teams[team]=identities.size===1?"confirmed":identities.size>1?"conflicting_confirmations":"missing_verified_confirmation";
  }
  const ready=Object.values(teams).every(v=>v==="confirmed");
  results.push({gameId:id,ready,teams});
 }
 return {asOf:now,mode:"read_only",games:results.length,bothConfirmed:results.filter(r=>r.ready).length,
  missingOrConflicting:results.filter(r=>!r.ready).length,results};
}
async function main(){
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error("missing_server_credentials");
 const now=new Date().toISOString();
 const [schedules,evidence]=await Promise.all([
  readTable(url,key,"nhl_core43_schedule_snapshots","select=game_id,kickoff_at,away_team,home_team&kickoff_at=gt."+encodeURIComponent(now)+"&limit=1000"),
  readTable(url,key,"nhl_core43_starter_evidence","select=game_id,team_code,goalie_id,evidence_status,source_name,source_url,source_published_at,verified_at&verified_at=lte."+encodeURIComponent(now)+"&limit=1000")
 ]);
 console.log(JSON.stringify(auditCoverage({schedules,evidence,now}),null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={auditCoverage};
