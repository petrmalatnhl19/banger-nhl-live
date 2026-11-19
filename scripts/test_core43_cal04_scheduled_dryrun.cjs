"use strict";
const assert=require("node:assert/strict");
const {summarize,run}=require("./core43_cal04_scheduled_dryrun.cjs");
const now="2026-11-09T22:00:00Z";
const payload={gameId:42,awayTeam:"DAL",homeTeam:"NYR",predictionAt:"2026-11-09T21:59:00Z",kickoffAt:"2026-11-09T23:00:00Z",
 baseline:{away:3,home:2.8,predictedAt:"2026-11-09T12:00:00Z"},
 observations:[["DAL","Goalie A"],["NYR","Goalie B"]].map(([team_code,goalie_name])=>({game_id:42,team_code,goalie_name,observed_status:"projected",observed_at:"2026-11-09T14:00:00Z",source_snapshot_at:"2026-11-09T13:00:00Z"})),
 identities:[["DAL","goalie a","8471234"],["NYR","goalie b","8475678"]].map(([team_code,normalized_name,goalie_id])=>({team_code,normalized_name,goalie_id,observed_at:"2026-11-09T12:00:00Z"})),
 gsaxRows:[{playerId:"8471234",team:"DAL",situation:"all",xGoals:"52",goals:"49",ongoal:"600"},{playerId:"8475678",team:"NYR",situation:"all",xGoals:"40",goals:"42",ongoal:"500"}],
 gsaxFetchedAt:"2026-11-09T21:30:00Z"};
const game={gameId:"42",baselineReady:true,payload,provenance:{gsaxArchiveId:"snapshot-1",baselineModel:"core42"}};
const r=summarize({now,games:[game,game,{gameId:"99",baselineReady:false,reason:"missing_baseline"}]});
assert.equal(r.checked,3);
assert.equal(r.ready,1);
assert.equal(r.duplicates,1);
assert.equal(r.skipped,1);
assert.equal(r.results[0].variants.length,4);
assert.equal(r.results[1].variants.every(x=>x.duplicate),true);
assert.equal(r.databaseWrites,0);
assert.equal(r.production,false);
const calls=[];
run({url:"https://example.supabase.co",key:"test",now,fetchImpl:async(url,opts)=>{
 calls.push({url,method:opts.method});
 return {ok:true,json:async()=>[]};
}}).then(empty=>{
 assert.equal(empty.checked,0);
 assert.equal(calls.length,2);
 assert.equal(calls.every(x=>x.method==="GET"),true);
 console.log("CORE43-CAL-04 scheduled dry-run tests passed");
}).catch(e=>{console.error(e);process.exitCode=1});
