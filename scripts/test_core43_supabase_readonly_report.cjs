"use strict";
const assert=require("node:assert/strict");
const {reportFromRows,fetchRows}=require("./core43_supabase_readonly_report.cjs");
const prediction={game_id:42,away_team:"DAL",home_team:"NJD",core41_predicted_at:"2026-11-09T14:00:00Z"};
const schedule={game_id:42,away_team:"DAL",home_team:"NJD",kickoff_at:"2026-11-09T20:00:00Z",fetched_at:"2026-11-09T11:00:00Z"};
const goalie=(team,name)=>({game_id:42,team_code:team,goalie_name:name,observed_status:"projected",observed_at:"2026-11-09T13:00:00Z",source_snapshot_at:"2026-11-09T12:00:00Z"});
const identity=(team,name,id)=>({team_code:team,goalie_name:name,goalie_id:id,observed_at:"2026-11-09T11:00:00Z"});
const data={predictions:[prediction],schedules:[schedule],goalies:[goalie("DAL","Goalie One"),goalie("NJD","Goalie Two")],identityMap:[identity("DAL","Goalie One","123"),identity("NJD","Goalie Two","456")],starterEvidence:[]};
assert.equal(reportFromRows(data).counts.ready_projected,1);
assert.equal(reportFromRows({...data,schedules:[{...schedule,fetched_at:"2026-11-09T15:00:00Z"}]}).counts.unavailable,1);
assert.equal(reportFromRows({...data,identityMap:[]}).counts.unavailable,1);
assert.equal(reportFromRows(data).games[0].persistable,false);
(async()=>{
 let calls=0;
 const rows=await fetchRows({url:"https://example.supabase.co",key:"test",table:"nhl_prediction_archive",select:"game_id",gameId:"42",fetchImpl:async(u,options)=>{
  calls++;assert.match(u,/game_id=eq.42/);assert.equal(options.method,"GET");
  return {ok:true,json:async()=>[{game_id:42}]};
 }});
 assert.equal(calls,1);assert.equal(rows.length,1);
 console.log("CORE 4.3 Supabase read-only report tests passed");
})().catch(e=>{console.error(e);process.exitCode=1;});
