"use strict";
const assert=require("node:assert/strict");
const {auditConfirmationPipeline}=require("./core43_confirmation_pipeline_audit.cjs");
const at="2026-11-10T12:00:00Z";
const p=id=>({game_id:id,core41_predicted_at:at});
const o=(id,observed,snapshot)=>({game_id:id,observed_status:"confirmed",observed_at:observed,source_snapshot_at:snapshot});
const e=(id,published,verified)=>({game_id:id,evidence_status:"confirmed",source_url:"https://example.org/starter",source_published_at:published,verified_at:verified});
const result=auditConfirmationPipeline({predictions:[p(1),p(2),p(3)],
 observations:[o(1,"2026-11-10T11:30:00Z","2026-11-10T11:20:00Z"),o(2,"2026-11-10T12:30:00Z","2026-11-10T11:45:00Z")],
 evidence:[e(1,"2026-11-10T11:20:00Z","2026-11-10T11:35:00Z"),e(2,"2026-11-10T11:45:00Z","2026-11-10T12:30:00Z")]});
assert.equal(result.counts.confirmedSeenBeforePrediction,1);
assert.equal(result.counts.confirmedFirstSeenAfterPrediction,1);
assert.equal(result.counts.confirmedSnapshotBeforeButObservedAfter,1);
assert.equal(result.counts.confirmedWithTimelyEvidence,1);
assert.equal(result.counts.noConfirmedObservation,1);
assert.equal(result.games.find(g=>g.gameId==="2").firstConfirmedObservedDelayMinutes,30);
assert.equal(result.production,false);
console.log("CORE 4.3 confirmation pipeline audit tests passed");
