const assert=require("node:assert/strict");
const {evaluateProjectedReliability:run}=require("./core43_projected_reliability_audit.cjs");
const base={gameId:1,teamCode:"DAL",kickoffAt:"2026-11-09T20:00:00Z",
 predictedAt:"2026-11-09T17:00:00Z",actualVerifiedAt:"2026-11-09T22:00:00Z",
 predictedGoalieId:"10",actualStarterGoalieId:"10",actualSourceStatus:"verified",predictionStatus:"projected"};
const one=run([base]);
assert.equal(one.eligible,1);
assert.equal(one.byLeadTime["2_to_6h"].observedAccuracy,null);
assert.equal(one.byLeadTime["2_to_6h"].usableAsProbability,false);
const many=run(Array.from({length:30},(_,i)=>({...base,gameId:i+1,actualStarterGoalieId:i<24?"10":"11"})));
assert.equal(many.byLeadTime["2_to_6h"].observedAccuracy,0.8);
assert.equal(many.calibrated,false);
assert.equal(many.byLeadTime["2_to_6h"].usableAsProbability,false);
assert.equal(run([{...base,actualSourceStatus:"unverified"}]).eligible,0);
assert.equal(run([{...base,predictedAt:"2026-11-09T21:00:00Z"}]).eligible,0);
assert.equal(run([{...base,predictionStatus:"confirmed"}]).eligible,0);
assert.throws(()=>run([base],{minSample:1}),TypeError);
const repeated=run(Array.from({length:30},()=>({...base})));
assert.equal(repeated.eligible,0);
assert.equal(repeated.byLeadTime["2_to_6h"].observedAccuracy,null);
assert.equal(repeated.excluded.duplicate_or_conflicting_pick,30);
const conflicted=run([{...base},{...base,actualStarterGoalieId:"11"}]);
assert.equal(conflicted.eligible,0);
assert.equal(conflicted.excluded.duplicate_or_conflicting_pick,2);
const independent=run(Array.from({length:30},(_,i)=>({...base,gameId:i+1})));
assert.equal(independent.eligible,30);
assert.equal(independent.byLeadTime["2_to_6h"].observedAccuracy,1);
console.log("CORE 4.3 projected reliability audit tests passed");
