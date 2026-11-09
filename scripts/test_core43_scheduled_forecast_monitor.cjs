"use strict";
const assert=require("node:assert/strict");
const {summarize}=require("./core43_scheduled_forecast_monitor.cjs");
const now="2026-11-09T12:00:00Z",kickoff_at="2026-11-10T12:00:00Z";
const s=(game_id)=>({game_id,kickoff_at,away_team:"DAL",home_team:"UTA"});
const p=(game_id)=>({game_id,away_team:"DAL",home_team:"UTA",
 core41_predicted_at:"2026-11-09T11:00:00Z",core41_away:3,core41_home:2,core41_factors:{ok:true}});
let r=summarize({now,schedules:[s(1),s(2)],predictions:[p(1)]});
assert.equal(r.futureGames,2);assert.equal(r.core41Valid,1);assert.equal(r.awaitingForecast,1);assert.equal(r.blocked,0);
r=summarize({now,schedules:[s(1)],predictions:[{...p(1),core41_predicted_at:kickoff_at}]});
assert.equal(r.blocked,1);assert.equal(r.core41Valid,0);
r=summarize({now,schedules:[s(1),{...s(1),home_team:"NYR"}],predictions:[p(1)]});
assert.equal(r.blocked,1);
r=summarize({now,schedules:[s(1)],predictions:[{...p(1),core41_away:null}]});
assert.equal(r.blocked,1);
console.log("CORE 4.3 scheduled monitor tests passed");
