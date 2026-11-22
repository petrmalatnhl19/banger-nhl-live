'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditEventStrengthAgreement:audit}=require('../scripts/lineups_event_strength_agreement.cjs');
const shifts=[...Array.from({length:5},(_,i)=>({teamId:22,playerId:220+i,start:0,end:100})),...Array.from({length:5},(_,i)=>({teamId:13,playerId:130+i,start:0,end:100}))];
test('matches NHL 1551 event with five skaters on both teams',()=>{
 const r=audit([{periodDescriptor:{number:1},timeInPeriod:'00:15',situationCode:'1551'}],shifts,22,13);
 assert.equal(r.checked,1);assert.equal(r.matched,1);assert.equal(r.verifiedStrengthWindows,false);
});
test('flags strength mismatch without inferring intervals',()=>{
 const r=audit([{periodDescriptor:{number:1},timeInPeriod:'00:15',situationCode:'1451'}],shifts,22,13);
 assert.equal(r.mismatched,1);assert.equal(r.verifiedStrengthWindows,false);
});
test('invalid event clocks are skipped',()=>{
 const r=audit([{periodDescriptor:{number:1},timeInPeriod:'20:00',situationCode:'1551'}],shifts,22,13);
 assert.equal(r.skipped,1);assert.equal(r.status,'unverified');
});
test('duplicate shifts fail closed',()=>{
 assert.equal(audit([], [...shifts,shifts[0]],22,13).status,'unverified');
});
