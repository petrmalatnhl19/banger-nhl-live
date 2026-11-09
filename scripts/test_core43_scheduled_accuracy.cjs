"use strict";
const assert=require("node:assert/strict");
const {evaluate}=require("./core43_scheduled_accuracy.cjs");
const s=(id)=>({game_id:id,kickoff_at:"2026-11-09T20:00:00Z",away_team:"DAL",home_team:"UTA"});
const a=(id,overrides={})=>({game_id:id,status:"final",away_team:"DAL",home_team:"UTA",
 actual_away:3,actual_home:2,core41_predicted_at:"2026-11-09T19:00:00Z",
 core41_away:3.2,core41_home:2.1,core42_predicted_at:"2026-11-09T19:30:00Z",
 core42_away:2.1,core42_home:3.2,...overrides});
let r=evaluate({schedules:[s(1),s(2)],archives:[a(1),a(2,{core42_predicted_at:null,core42_away:null,core42_home:null})]});
assert.equal(r.results[0].games,2);
assert.equal(r.results[0].correctWinners,2);
assert.equal(r.results[1].games,1);
assert.equal(r.results[1].correctWinners,0);
assert.equal(r.pairedGames,1);
assert.equal(r.results[2].games,1);
assert.equal(r.results[3].games,1);
r=evaluate({schedules:[s(1)],archives:[a(1,{core41_predicted_at:"2026-11-09T20:00:00Z"})]});
assert.equal(r.results[0].games,0);
r=evaluate({schedules:[s(1),{...s(1),home_team:"NYR"}],archives:[a(1)]});
assert.equal(r.results[0].games,0);
r=evaluate({schedules:[s(1)],archives:[a(1,{core41_away:2.5,core41_home:2.5})]});
assert.equal(r.results[0].winnerCalls,0);
assert.equal(r.results[0].goalsMAE!==null,true);
console.log("CORE 4.3 scheduled accuracy tests passed");
