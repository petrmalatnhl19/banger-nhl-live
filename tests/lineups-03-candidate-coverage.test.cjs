'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditCandidateCoverage:audit}=require('../scripts/lineups_candidate_coverage_audit.cjs');
const intervals=[{startSecond:1,endSecondExclusive:11,strength:'5v4'},{startSecond:20,endSecondExclusive:30,strength:'4v5'},{startSecond:40,endSecondExclusive:50,strength:'5v6'}];
const units={status:'candidate-only',teams:[{teamId:22,units:[{strength:'5v4',seconds:8},{strength:'4v5',seconds:5}]},{teamId:13,units:[{strength:'5v4',seconds:8},{strength:'4v5',seconds:9}]}]};
test('coverage is candidate-only, per side, excludes six skaters',()=>{
 const r=audit(intervals,units,22,13);
 assert.equal(r.publishable,false);assert.equal(r.verifiedUnits,false);
 assert.equal(r.teams[0].PP.candidateSeconds,10);assert.equal(r.teams[0].PP.topUnitShareOfCandidateSeconds,.8);
 assert.equal(r.teams[1].PP.candidateSeconds,10);assert.equal(r.teams[1].PP.topUnitShareOfCandidateSeconds,.9);
 assert.equal(r.teams[0].PP.fullGameCoverage,'unknown');
});
test('overlapping intervals fail closed',()=>assert.equal(audit([...intervals,{startSecond:45,endSecondExclusive:60,strength:'5v4'}],units,22,13).status,'unverified'));
test('missing candidate units fail closed',()=>assert.equal(audit(intervals,{},22,13).status,'unverified'));
