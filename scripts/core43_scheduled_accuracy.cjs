"use strict";
// Read-only verified accuracy for frozen CORE 4.1 and CORE 4.2 forecasts.
const {readTable}=require("./monitor_core43_revisions.cjs");
function evaluate({schedules=[],archives=[]}={}){
 const bySchedule=new Map();
 for(const s of schedules){
  const id=String(s.game_id),old=bySchedule.get(id);
  if(old?.conflict)continue;
  if(old&&(old.kickoff_at!==s.kickoff_at||old.away_team!==s.away_team||old.home_team!==s.home_team)){
   bySchedule.set(id,{conflict:true});continue;
  }
  bySchedule.set(id,s);
 }
 const records=[];
 for(const a of archives){
  if(a.status!=="final"||!Number.isInteger(a.actual_away)||!Number.isInteger(a.actual_home)||a.actual_away===a.actual_home)continue;
  const s=bySchedule.get(String(a.game_id)),kickoff=Date.parse(s?.kickoff_at);
  if(!s||s.conflict||!Number.isFinite(kickoff)||s.away_team!==a.away_team||s.home_team!==a.home_team)continue;
  for(const model of ["core41","core42"]){
   const at=Date.parse(a[model+"_predicted_at"]);
   const away=a[model+"_away"],home=a[model+"_home"];
   if(!Number.isFinite(at)||at>=kickoff||!Number.isFinite(away)||!Number.isFinite(home))continue;
   records.push({gameId:String(a.game_id),model,correct:away===home?null:(away>home)===(a.actual_away>a.actual_home),
    abs:(Math.abs(away-a.actual_away)+Math.abs(home-a.actual_home))/2,
    sq:((away-a.actual_away)**2+(home-a.actual_home)**2)/2});
  }
 }
 const paired=new Set();
 const gameModels=new Map();
 for(const r of records){if(!gameModels.has(r.gameId))gameModels.set(r.gameId,new Set());gameModels.get(r.gameId).add(r.model);}
 for(const [id,models] of gameModels)if(models.size===2)paired.add(id);
 function summarize(rows,model,cohort){
  const data=rows.filter(r=>r.model===model),called=data.filter(r=>r.correct!==null);
  return {cohort,model,games:data.length,winnerCalls:called.length,correctWinners:called.filter(r=>r.correct).length,
   winnerAccuracy:called.length?called.filter(r=>r.correct).length/called.length:null,
   goalsMAE:data.length?data.reduce((sum,r)=>sum+r.abs,0)/data.length:null,
   goalsRMSE:data.length?Math.sqrt(data.reduce((sum,r)=>sum+r.sq,0)/data.length):null};
 }
 const pairedRecords=records.filter(r=>paired.has(r.gameId));
 return {mode:"read_only",pairedGames:paired.size,results:[
  ...["core41","core42"].map(m=>summarize(records,m,"all_verified")),
  ...["core41","core42"].map(m=>summarize(pairedRecords,m,"paired_subset"))]};
}
async function main(){
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error("missing_server_credentials");
 const [schedules,archives]=await Promise.all([
  readTable(url,key,"nhl_core43_schedule_snapshots","select=game_id,kickoff_at,away_team,home_team&limit=1000"),
  readTable(url,key,"nhl_prediction_archive","select=game_id,status,actual_away,actual_home,away_team,home_team,core41_predicted_at,core41_away,core41_home,core42_predicted_at,core42_away,core42_home&status=eq.final&limit=1000")
 ]);
 const report=evaluate({schedules,archives});
 console.log(JSON.stringify(report,null,2));
 const summary=process.env.GITHUB_STEP_SUMMARY;
 if(summary)require("node:fs").appendFileSync(summary,
  "## CORE 4.3 verified accuracy (read-only)\n\n"+
  "| Cohort | Model | Games | Correct / calls | Accuracy | Goals MAE | Goals RMSE |\n|---|---|---:|---:|---:|---:|---:|\n"+
  report.results.map(r=>"| "+r.cohort+" | "+r.model+" | "+r.games+" | "+r.correctWinners+" / "+r.winnerCalls+
   " | "+(r.winnerAccuracy===null?"N/A":(100*r.winnerAccuracy).toFixed(1)+"%")+
   " | "+(r.goalsMAE?.toFixed(3)??"N/A")+" | "+(r.goalsRMSE?.toFixed(3)??"N/A")+" |").join("\n")+
  "\n\nPaired comparison uses identical games; small samples are not proof of superiority.\n");
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={evaluate};
