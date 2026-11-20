'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditPenaltyOverlapProvenance:audit}=require('../scripts/lineups_penalty_overlap_provenance.cjs');
const window={startSecond:110,seconds:10,strength:'5v4'};
const penalty=(second,windows)=>({teamId:13,minutes:2,second,nearbyCandidateWindows:windows});
test('two penalties share ten unique seconds',()=>{
 const r=audit({status:'penalty-context-only',penalties:[penalty(100,[window]),penalty(105,[window])]},22,13);
 assert.equal(r.uniqueSeconds,10);assert.equal(r.distinctPenaltyOverlapSeconds,10);assert.equal(r.repeatedWindowSeconds,0);assert.equal(r.publishable,false);
});
test('same penalty duplicated window is not counted as second penalty',()=>{
 const r=audit({status:'penalty-context-only',penalties:[penalty(100,[window,window])]},22,13);
 assert.equal(r.uniqueSeconds,10);assert.equal(r.distinctPenaltyOverlapSeconds,0);assert.equal(r.repeatedWindowSeconds,10);
});
test('missing evidence fails closed',()=>assert.equal(audit({},22,13).status,'unverified'));
