"use strict";
// Scheduled read-only monitoring of frozen CORE 4.1 / CORE 4.2 forecasts.
// No database writes, no new predictions, no secrets in output.
const {readTable}=require("./monitor_core43_revisions.cjs");
function summarize({schedules=[],predictions=[],now}){
 const t=Date.parse(now);if(!Number.isFinite(t))throw Error("invalid_asof");
 const byGame=new Map();
 for(const s of schedules){
  const id=String(s.game_id),prev=byGame.get(id);
  if(prev?.conflict)continue;
  if(prev&&(prev.kickoff_at!==s.kickoff_at||prev.away_team!==s.away_team||prev.home_team!==s.home_team)){
   byGame.set(id,{conflict:true});continue;
  }
  byGame.set(id,s);
 }
 const byPrediction=new Map(predictions.map(p=>[String(p.game_id),p]));
 const counts={futureGames:0,awaitingForecast:0,core41Valid:0,core42Valid:0,blocked:0};
 for(const [id,s] of byGame){
  if(s.conflict){counts.blocked++;continue;}
  const kickoff=Date.parse(s.kickoff_at);
  if(!Number.isFinite(kickoff)){counts.blocked++;continue;}
  if(kickoff<=t)continue;
  counts.futureGames++;
  const p=byPrediction.get(id);
  if(!p){counts.awaitingForecast++;continue;}
  if(p.away_team!==s.away_team||p.home_team!==s.home_team){counts.blocked++;continue;}
  for(const model of ["core41","core42"]){
   const at=p[model+"_predicted_at"];
   if(at==null)continue;
   const predicted=Date.parse(at);
   if(!Number.isFinite(predicted)||predicted>=kickoff||predicted>t||
      !Number.isFinite(p[model+"_away"])||!Number.isFinite(p[model+"_home"])||
      p[model+"_factors"]==null){counts.blocked++;continue;}
   counts[model+"Valid"]++;
  }
  if(p.core41_predicted_at==null)counts.awaitingForecast++;
 }
 return {mode:"read_only",asOf:now,...counts};
}
async function main(){
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error("missing_server_credentials");
 const now=new Date().toISOString();
 const [schedules,predictions]=await Promise.all([
  readTable(url,key,"nhl_core43_schedule_snapshots","select=game_id,kickoff_at,away_team,home_team&limit=1000"),
  readTable(url,key,"nhl_prediction_archive","select=game_id,away_team,home_team,core41_predicted_at,core41_away,core41_home,core41_factors,core42_predicted_at,core42_away,core42_home,core42_factors&limit=1000")
 ]);
 const report=summarize({schedules,predictions,now});
 console.log(JSON.stringify(report,null,2));
 const fs=require("node:fs");fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY||"/dev/null",
  "## CORE 4.3 frozen forecast monitor\n\n"+Object.entries(report).map(([k,v])=>"- **"+k+"**: "+v).join("\n")+"\n");
 if(report.blocked>0)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={summarize};
