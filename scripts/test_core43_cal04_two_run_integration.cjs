"use strict";
const assert=require("node:assert/strict");
const {run}=require("./core43_cal04_scheduled_dryrun.cjs");
const t="2026-11-09T22:00:00Z",t2="2026-11-09T22:10:00Z";
const sha="a".repeat(64);
const data={
 nhl_core43_schedule_snapshots:[{game_id:42,away_team:"DAL",home_team:"NYR",kickoff_at:"2026-11-09T23:00:00Z",fetched_at:"2026-11-09T20:00:00Z"}],
 nhl_prediction_archive:[{game_id:42,away_team:"DAL",home_team:"NYR",core42_predicted_at:"2026-11-09T12:00:00Z",core42_away:3,core42_home:2.8}],
 nhl_core43_rotowire_observations:[["DAL","Goalie A"],["NYR","Goalie B"]].map(([team_code,goalie_name])=>({game_id:42,team_code,goalie_name,observed_status:"projected",observed_at:"2026-11-09T14:00:00Z",source_snapshot_at:"2026-11-09T13:00:00Z"})),
 nhl_core43_goalie_identity_map:[["DAL","Goalie A","8471234"],["NYR","Goalie B","8475678"]].map(([team_code,goalie_name,goalie_id])=>({team_code,goalie_name,goalie_id,observed_at:"2026-11-09T12:00:00Z"})),
 nhl_core43_goalie_snapshots:[["DAL","8471234",52,49,600],["NYR","8475678",40,42,500]].map(([team_code,goalie_id,x_goals_against,goals_against,shots_against])=>({team_code,goalie_id,x_goals_against,goals_against,shots_against,situation:"all",fetched_at:"2026-11-09T21:30:00Z",created_at:"2026-11-09T21:31:00Z",source_sha256:sha}))
};
const calls=[];
async function fakeFetch(url,options){
 calls.push({url,method:options.method});
 const table=new URL(url).pathname.split("/").at(-1);
 if(!(table in data))throw Error("unexpected_table_"+table);
 const rows=data[table];
 const id=new URL(url).searchParams.get("game_id");
 return {ok:true,json:async()=>id?rows.filter(r=>String(r.game_id)===id.slice(3)):rows};
}
(async()=>{
 const base={url:"https://example.supabase.co",key:"readonly",fetchImpl:fakeFetch};
 const first=await run({...base,now:t,existingKeys:[]});
 assert.equal(first.checked,1,JSON.stringify(first));
 assert.equal(first.ready,1,JSON.stringify(first));
 assert.equal(first.results[0].variants.length,4);
 assert.equal(first.ledger.keys.length,4);
 const second=await run({...base,now:t2,existingKeys:first.ledger.keys});
 assert.equal(second.checked,1,JSON.stringify(second));
 assert.equal(second.duplicates,1,JSON.stringify(second));
 assert.equal(second.ready,0);
 assert.deepEqual(second.ledger.keys,first.ledger.keys);
 assert.equal(calls.every(c=>c.method==="GET"),true);
 assert.equal(first.databaseWrites,0);
 assert.equal(second.databaseWrites,0);
 console.log("CORE43-CAL-04 two-run integration passed");
})().catch(e=>{console.error(e);process.exitCode=1});
