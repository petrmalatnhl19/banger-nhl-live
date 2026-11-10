const assert=require("node:assert/strict");
const {loadAndCompute,readAllProvenance,readAllCoreInputs}=require("./run_core43_shadow_readonly.cjs");
(async()=>{
 const now="2026-11-09T15:00:00Z";
 const rows={
  nhl_prediction_archive:[{game_id:42,away_team:"DAL",home_team:"NJD",core41_predicted_at:"2026-11-09T10:00:00Z",core41_away:2.8,core41_home:3.2}],
  nhl_core43_schedule_snapshots:[{game_id:42,away_team:"DAL",home_team:"NJD",kickoff_at:"2026-11-09T20:00:00Z"}],
  nhl_core43_starter_evidence:[],
  nhl_core43_rotowire_observations:[],
  nhl_core43_shadow_inputs:["away","home"].map((side,i)=>({game_id:42,side,team_code:side==="away"?"DAL":"NJD",goalie_id:String(100+i),readiness:"ready",starter_status:"confirmed",gsax:i===0?2:-1,shots_against:100,prediction_at:now,captured_at:"2026-11-09T14:00:00Z",gsax_fetched_at:"2026-11-09T13:00:00Z",starter_published_at:"2026-11-09T12:00:00Z",starter_verified_at:"2026-11-09T13:00:00Z"}))
 };
 const calls=[];
 const fetchImpl=async(url,opts)=>{calls.push({url,opts});const table=url.split("/rest/v1/")[1].split("?")[0];return {ok:true,json:async()=>rows[table]};};
 const result=await loadAndCompute({url:"https://example.supabase.co",key:"test",now,fetchImpl});
 assert.equal(result.available,1);
 assert.equal(result.results[0].expectedAwayGoals,2.82);
 assert.equal(result.results[0].production,false);
 assert.equal(calls.length,5);
 assert(calls.every(c=>!c.opts.method||c.opts.method==="GET"));
 rows.nhl_core43_starter_evidence.push({game_id:42,team_code:"DAL",goalie_id:"100",source_name:"RotoWire",source_published_at:"2026-11-09T12:00:00Z"});
 rows.nhl_core43_rotowire_observations.push({game_id:42,team_code:"DAL",source_snapshot_at:"2026-11-09T12:00:00Z"});
 const blocked=await loadAndCompute({url:"https://example.supabase.co",key:"test",now,fetchImpl});
 assert.equal(blocked.available,0);
 assert.equal(blocked.results[0].reason,"suspect_away_starter_provenance");
 rows.nhl_core43_starter_evidence.length=0;
 rows.nhl_core43_rotowire_observations.length=0;
 rows.nhl_core43_shadow_inputs.pop();
 assert.equal((await loadAndCompute({url:"https://example.supabase.co",key:"test",now,fetchImpl})).available,0);
 const many=Array.from({length:5},(_,i)=>({game_id:i}));
 const pagedFetch=async(url)=>{
  const params=new URL(url).searchParams;
  const offset=Number(params.get("offset"));
  const limit=Number(params.get("limit"));
  return {ok:true,json:async()=>many.slice(offset,offset+limit)};
 };
 const complete=await readAllProvenance("https://example.supabase.co","test","nhl_core43_starter_evidence","game_id",pagedFetch,{pageSize:2,maxRows:10});
 assert.deepEqual(complete,many);
 const allInputs=await readAllCoreInputs("https://example.supabase.co","test","nhl_prediction_archive","select=game_id","game_id.asc",pagedFetch,{pageSize:2,maxRows:10});
 assert.deepEqual(allInputs,many);
 await assert.rejects(()=>readAllCoreInputs("https://example.supabase.co","test","nhl_prediction_archive","select=game_id","game_id.asc",pagedFetch,{pageSize:2,maxRows:4}),/core43_input_limit_exceeded/);
 await assert.rejects(()=>readAllProvenance("https://example.supabase.co","test","nhl_core43_starter_evidence","game_id",pagedFetch,{pageSize:2,maxRows:4}),/provenance_limit_exceeded/);
 console.log("CORE 4.3 read-only Supabase integration tests passed");
})().catch(e=>{console.error(e);process.exitCode=1});
