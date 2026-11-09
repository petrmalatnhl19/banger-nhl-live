const assert=require("node:assert/strict");
const {loadAndCompute}=require("./run_core43_shadow_readonly.cjs");
(async()=>{
 const now="2026-11-09T15:00:00Z";
 const rows={
  nhl_prediction_archive:[{game_id:42,away_team:"DAL",home_team:"NJD",core41_predicted_at:"2026-11-09T10:00:00Z",core41_away:2.8,core41_home:3.2}],
  nhl_core43_schedule_snapshots:[{game_id:42,away_team:"DAL",home_team:"NJD",kickoff_at:"2026-11-09T20:00:00Z"}],
  nhl_core43_shadow_inputs:["away","home"].map((side,i)=>({game_id:42,side,team_code:side==="away"?"DAL":"NJD",goalie_id:String(100+i),readiness:"ready",starter_status:"confirmed",gsax:i===0?2:-1,shots_against:100,prediction_at:now,captured_at:"2026-11-09T14:00:00Z",gsax_fetched_at:"2026-11-09T13:00:00Z",starter_published_at:"2026-11-09T12:00:00Z",starter_verified_at:"2026-11-09T13:00:00Z"}))
 };
 const calls=[];
 const fetchImpl=async(url,opts)=>{calls.push({url,opts});const table=url.split("/rest/v1/")[1].split("?")[0];return {ok:true,json:async()=>rows[table]};};
 const result=await loadAndCompute({url:"https://example.supabase.co",key:"test",now,fetchImpl});
 assert.equal(result.available,1);
 assert.equal(result.results[0].expectedAwayGoals,2.82);
 assert.equal(result.results[0].production,false);
 assert.equal(calls.length,3);
 assert(calls.every(c=>!c.opts.method||c.opts.method==="GET"));
 rows.nhl_core43_shadow_inputs.pop();
 assert.equal((await loadAndCompute({url:"https://example.supabase.co",key:"test",now,fetchImpl})).available,0);
 console.log("CORE 4.3 read-only Supabase integration tests passed");
})().catch(e=>{console.error(e);process.exitCode=1});
