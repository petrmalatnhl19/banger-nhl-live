'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditRecoveryEventEvidence}=require('../scripts/lineups_03_44_recovery_event_evidence.cjs');
const play=(clock,code)=>({periodDescriptor:{number:1},timeInPeriod:clock,situationCode:code});
test('point evidence never verifies whole gap',()=>{
 const r=auditRecoveryEventEvidence({recoveryCandidates:[{startSecond:10,endSecondExclusive:30}],plays:[play('00:05','1551'),play('00:15','1551'),play('00:35','1551')]});
 assert.equal(r.windows[0].pointSupport,1);assert.equal(r.windows[0].status,'point-support-only');assert.equal(r.verifiedStrength,false);assert.equal(r.windows[0].publishable,false);
});
test('flags conflicting event strength',()=>{
 const r=auditRecoveryEventEvidence({recoveryCandidates:[{startSecond:10,endSecondExclusive:30}],plays:[play('00:12','1551'),play('00:20','1541')]});
 assert.equal(r.windows[0].conflictingEvents,1);assert.equal(r.windows[0].status,'conflicting-event-evidence');
});
test('reports absent event evidence and rejects invalid windows',()=>{
 const r=auditRecoveryEventEvidence({recoveryCandidates:[{startSecond:10,endSecondExclusive:30}],plays:[]});
 assert.equal(r.windows[0].status,'no-events-inside');
 assert.equal(auditRecoveryEventEvidence({recoveryCandidates:[{startSecond:20,endSecondExclusive:20}],plays:[]}).status,'unverified');
});
