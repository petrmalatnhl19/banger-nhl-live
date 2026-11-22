'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditFiveOnFiveCoverage}=require('../scripts/lineups_03_41_coverage_audit.cjs');
const base={regulationSeconds:20,intervals:[{strength:'5v5',startSecond:2,endSecondExclusive:7},{strength:'5v4',startSecond:7,endSecondExclusive:11},{strength:'5v5',startSecond:12,endSecondExclusive:17}],teams:[{teamId:22,candidateSeconds:9,skippedNonstandardSeconds:1},{teamId:13,candidateSeconds:8,skippedNonstandardSeconds:2}]};
test('counts candidate intervals, not all regulation as missing 5v5',()=>{
 const r=auditFiveOnFiveCoverage(base);assert.equal(r.status,'candidate-only');assert.equal(r.candidateFiveOnFiveSeconds,10);assert.equal(r.unclassifiedRegulationSeconds,10);assert.equal(r.gapCount,3);assert.deepEqual(r.gaps.map(g=>g.seconds),[5,3,2]);assert.equal(r.publishable,false);
});
test('rejects overlap, out-of-bounds and inconsistent team seconds',()=>{
 for(const x of [{intervals:[...base.intervals,{strength:'5v5',startSecond:16,endSecondExclusive:19}]},{intervals:[{strength:'5v5',startSecond:0,endSecondExclusive:21}]},{teams:[{...base.teams[0],candidateSeconds:11},base.teams[1]]},{teams:[base.teams[0],base.teams[0]]}])assert.equal(auditFiveOnFiveCoverage({...base,...x}).status,'unverified');
});
test('zero candidate time is explicit and does not imply zero real 5v5',()=>{
 const r=auditFiveOnFiveCoverage({regulationSeconds:10,intervals:[],teams:[{teamId:1,candidateSeconds:0,skippedNonstandardSeconds:0},{teamId:2,candidateSeconds:0,skippedNonstandardSeconds:0}]});assert.equal(r.status,'candidate-only');assert.equal(r.unclassifiedRegulationSeconds,10);
});
