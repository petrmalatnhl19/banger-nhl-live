"use strict";
const assert=require("node:assert/strict");
const {auditArchive}=require("./core43_archive_coverage_audit.cjs");
const p=(id,at)=>({game_id:id,away_team:"DAL",home_team:"NJD",core41_predicted_at:at});
const s=(id,fetched,kickoff="2026-11-09T20:00:00Z")=>({game_id:id,away_team:"DAL",home_team:"NJD",fetched_at:fetched,kickoff_at:kickoff});
const data={predictions:[p(1,null),p(2,"2026-11-09T14:00:00Z"),p(3,"2026-11-09T14:00:00Z")],schedules:[
 s(2,"2026-11-09T15:00:00Z"),s(3,"2026-11-09T12:00:00Z")]};
const r=auditArchive(data);
assert.equal(r.total,3);
assert.deepEqual(r.coverage,{missingPredictionTime:1,missingFrozenSchedule:1,usableFrozenSchedule:1});
assert.deepEqual(r.gameIds.missingFrozenSchedule,["2"]);
assert.equal(r.production,false);assert.equal(r.persistable,false);
assert.equal(auditArchive({...data,schedules:[s(2,"2026-11-09T12:00:00Z","2026-11-09T13:00:00Z"),data.schedules[1]]}).coverage.missingFrozenSchedule,1);
console.log("CORE 4.3 archive coverage audit tests passed");
