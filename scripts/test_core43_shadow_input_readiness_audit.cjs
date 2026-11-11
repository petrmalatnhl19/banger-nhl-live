"use strict";
const assert=require("node:assert/strict");
const {audit}=require("./core43_shadow_input_readiness_audit.cjs");
const base={game_id:1,side:"home",goalie_id:"1",gsax:0,
 prediction_at:"2026-11-10T19:00:00Z",captured_at:"2026-11-10T18:00:00Z",
 starter_published_at:"2026-11-10T17:00:00Z",
 starter_verified_at:"2026-11-10T18:00:00Z",readiness:"ready_projected"};
let result=audit([base]);
assert.equal(result.fullyTimeQualified,1);
result=audit([{...base,captured_at:"2026-11-10T19:00:01Z"}]);
assert.equal(result.capturedWithinFiveMinutes,1);
assert.equal(result.fullyTimeQualified,1);
result=audit([{...base,captured_at:"2026-11-10T19:06:00Z"}]);
assert.equal(result.capturedMoreThanFiveMinutesLate,1);
assert.equal(result.fullyTimeQualified,0);
assert.equal(result.projected,1);
assert.equal(result.missingGsax,0);
result=audit([{...base,game_id:2,goalie_id:null,gsax:null,
 starter_published_at:"2026-11-10T20:00:00Z",
 starter_verified_at:null,captured_at:"2026-11-10T20:00:00Z"}]);
assert.equal(result.fullyTimeQualified,0);
assert.equal(result.missingGoalieId,1);
assert.equal(result.missingGsax,1);
assert.equal(result.publishedAfterPrediction,1);
assert.equal(result.missingStarterVerifiedAt,1);
assert.equal(result.futureCaptured,1);
assert.equal(result.affectedGames,1);
result=audit([{...base,readiness:"ready_confirmed",starter_verified_at:"2026-11-10T20:00:00Z"}]);
assert.equal(result.confirmed,1);
assert.equal(result.verifiedAfterPrediction,1);
assert.equal(result.fullyTimeQualified,0);
result=audit([{...base,readiness:"ready",starter_status:"confirmed"},{...base,game_id:3,readiness:"missing_pregame_starter_evidence"},{...base,game_id:4,goalie_id:null,readiness:"missing_frozen_goalie_id"}]);
assert.equal(result.frozenReady,1);
assert.equal(result.missingPregameStarterEvidence,1);
assert.equal(result.missingFrozenGoalieId,1);
assert.equal(result.otherReadiness,0);
result=audit([{...base,readiness:"ready",starter_status:null}]);
assert.equal(result.issueCounts.ready_without_confirmed_starter,1);
console.log("CORE 4.3 shadow input readiness audit tests passed");
