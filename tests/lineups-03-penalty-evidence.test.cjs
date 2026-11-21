'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditPenaltyEvidence:audit}=require('../scripts/lineups_penalty_evidence_audit.cjs');
const plays=[{eventId:7,typeDescKey:'penalty',periodDescriptor:{number:1},timeInPeriod:'02:00',details:{eventOwnerTeamId:13,duration:2,typeCode:'MIN'}}];
const windows=[{startSecond:125,endSecondExclusive:155,strength:'5v4'},{startSecond:300,endSecondExclusive:320,strength:'5v5'}];
test('penalty context never verifies PP combinations',()=>{
 const r=audit(plays,windows,22,13);
 assert.equal(r.status,'penalty-context-only');assert.equal(r.verifiedStrengthWindows,false);assert.equal(r.publishable,false);
 assert.equal(r.penalties[0].second,120);assert.equal(r.penalties[0].nearbyCandidateWindows.length,2);
});
test('missing evidence fails closed',()=>assert.equal(audit(null,windows,22,13).status,'unverified'));
test('no penalty is not proof of even strength',()=>{
 const r=audit([],windows,22,13);assert.equal(r.penalties.length,0);assert.equal(r.verifiedUnits,false);
});
