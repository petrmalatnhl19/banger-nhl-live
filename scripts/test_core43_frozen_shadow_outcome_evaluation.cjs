"use strict";
const assert=require("node:assert/strict");
const {evaluateFrozenShadowOutcomes:run}=require("./core43_frozen_shadow_outcome_evaluation.cjs");
const at="2026-11-09T15:00:00Z",kickoff="2026-11-09T23:00:00Z";
const row={gameId:42,kickoffAt:kickoff,actual:{status:"verified_final",away:3,home:2,verifiedAt:"2026-11-10T03:00:00Z"},
 core41:{away:2.5,home:2.5,predictedAt:at},core42:{away:3,home:2.3,predictedAt:at},
 core43:{away:3.1,home:2.1,predictedAt:at,inputAsOf:at,frozenAt:"2026-11-09T15:01:00Z",frozenBeforeKickoff:true,production:false,persistable:false,calibrated:false,experimental:true}};
const ok=run([row]);
assert.equal(ok.pairedGames,1);
assert.equal(ok.metrics.core43.winnerAccuracy,1);
assert.equal(ok.metrics.core41.winnerCalls,0);
assert.equal(ok.metrics.core43.goalsMAE,0.10000000000000009);
assert.equal(ok.conclusion,"insufficient_paired_sample_no_accuracy_claim");
assert.equal(run([{...row,core43:{...row.core43,frozenAt:"2026-11-10T00:00:00Z"}}]).excluded.unverified_shadow_freeze,1);
assert.equal(run([{...row,core43:{...row.core43,frozenBeforeKickoff:false}}]).pairedGames,0);
assert.equal(run([{...row,core43:{...row.core43,inputAsOf:"2026-11-09T14:00:00Z"}}]).excluded.shadow_input_time_mismatch,1);
assert.equal(run([{...row,actual:{...row.actual,status:"unverified"}}]).excluded.missing_verified_final,1);
assert.equal(run([{...row,core42:{...row.core42,predictedAt:kickoff}}]).excluded.missing_or_late_paired_forecast,1);
assert.equal(run([]).metrics.core43.goalsMAE,null);
console.log("CORE 4.3 frozen shadow outcome evaluation tests passed");
