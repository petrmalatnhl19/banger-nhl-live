"use strict";
const assert=require("node:assert/strict");
const {run}=require("./core43_scheduled_pregame_monitor.cjs");
(async()=>{
 const now="2026-11-12T20:00:00Z";
 const rows={
  nhl_core43_schedule_snapshots:[{game_id:123,away_team:"TBL",home_team:"BUF",kickoff_at:"2026-11-12T21:00:00Z",fetched_at:"2026-11-12T19:00:00Z"}],
  nhl_prediction_archive:[],
  nhl_core43_rotowire_observations:[{game_id:123,team_code:"TBL",goalie_name:"Goalie A",observed_status:"projected",observed_at:"2026-11-12T19:00:00Z",source_snapshot_at:"2026-11-12T18:59:00Z"}],
  nhl_core43_goalie_identity_map:[],
  nhl_core43_starter_evidence:[]
 };
 const methods=[];
 const fetchImpl=async(url,opts)=>{methods.push(opts.method);const table=new URL(url).pathname.split("/").at(-1);return {ok:true,status:200,json:async()=>rows[table]||[]};};
 const result=await run({url:"https://example.supabase.co",key:"test-server-key",now,fetchImpl});
 assert.equal(result.checked,1);
 assert.equal(result.ready,0);
 assert.equal(result.results[0].reason,"missing_valid_core42_baseline");
 assert.equal(result.results[0].goalieDiagnostics.sides[0].observedStatus,"projected");
 assert.equal(result.results[0].goalieDiagnostics.sides[1].reason,"missing_pregame_observation");
 assert.equal(result.results[0].goalieDiagnostics.writes,0);
 assert.ok(methods.every(method=>method==="GET"));
 console.log("CORE 4.3 scheduled monitor goalie diagnostics passed");
})().catch(e=>{console.error(e);process.exitCode=1});
