const assert=require("node:assert/strict");
const {pairedMetrics}=require("./core43_paired_evaluation.cjs");
const kickoffAt="2026-11-09T20:00:00Z";
const row={gameId:1,kickoffAt,actual:{away:2,home:3},
 core41:{away:3,home:3,predictedAt:"2026-11-09T10:00:00Z"},
 core43:{away:2,home:3,predictedAt:"2026-11-09T18:00:00Z"}};
const result=pairedMetrics([row]);
assert.equal(result.pairedGames,1);
assert.equal(result.baselineMAE,0.5);
assert.equal(result.challengerMAE,0);
assert.equal(result.maeImprovement,0.5);
assert.equal(result.conclusion,"insufficient_paired_sample_no_accuracy_claim");
assert.equal(pairedMetrics([{...row,core43:{...row.core43,predictedAt:"2026-11-09T21:00:00Z"}}]).pairedGames,0);
assert.equal(pairedMetrics([{...row,core43:null}]).pairedGames,0);
assert.equal(pairedMetrics([]).baselineMAE,null);
console.log("CORE 4.3 paired evaluation tests passed");
