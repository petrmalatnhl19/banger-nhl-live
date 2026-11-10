"use strict";
const assert=require("node:assert/strict");
const {summary}=require("./core43_diagnostic_summary.cjs");
const output=summary({total:3,coverage:{usableFrozenSchedule:1,missingPredictionTime:1,missingFrozenSchedule:1},starterReadiness:{ready_confirmed:0,ready_projected:1,unavailable:2}});
assert.match(output,/Archived games \| 3/);
assert.match(output,/Projected starter readiness \| 1/);
assert.match(output,/No production prediction writes/);
console.log("CORE 4.3 diagnostic summary tests passed");
