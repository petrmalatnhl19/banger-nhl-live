'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditPenaltyDirection:audit}=require('../scripts/lineups_penalty_direction_audit.cjs');
const base={status:'penalty-context-only',penalties:[{eventId:1,second:100,teamId:13,minutes:2,nearbyCandidateWindows:[{startSecond:105,seconds:20,strength:'5v4'},{startSecond:130,seconds:10,strength:'5v5'}]}]};
test('Florida penalty supports Edmonton advantage but never verifies it',()=>{
 const r=audit(base,22,13);assert.equal(r.penalties[0].assessment,'direction-supported');assert.equal(r.penalties[0].matchingCandidateSeconds,20);assert.equal(r.publishable,false);
});
test('opposite direction triggers review',()=>{
 const r=audit({...base,penalties:[{...base.penalties[0],nearbyCandidateWindows:[{startSecond:105,seconds:20,strength:'4v5'}]}]},22,13);
 assert.equal(r.penalties[0].assessment,'needs-review');assert.equal(r.penalties[0].opposingCandidateSeconds,20);
});
test('six skaters and missing evidence cannot establish PP',()=>{
 const r=audit({...base,penalties:[{...base.penalties[0],nearbyCandidateWindows:[{startSecond:105,seconds:20,strength:'5v6'}]}]},22,13);
 assert.equal(r.penalties[0].assessment,'needs-review');assert.equal(audit({},22,13).status,'unverified');
});
