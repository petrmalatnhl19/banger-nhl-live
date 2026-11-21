'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditStrengthBoundaryMismatches:audit}=require('../scripts/lineups_strength_boundary_audit.cjs');
const shifts=[...Array.from({length:5},(_,i)=>({teamId:22,playerId:220+i,start:0,end:20})),...Array.from({length:5},(_,i)=>({teamId:13,playerId:130+i,start:0,end:20}))];
const event=(time,code)=>({periodDescriptor:{number:1},timeInPeriod:time,situationCode:code});
test('classifies mismatches at shift boundary and away from it',()=>{
 const r=audit([event('00:19','1451'),event('00:10','1451'),event('00:05','1551')],shifts,22,13);
 assert.equal(r.checked,3);assert.equal(r.mismatches,2);assert.equal(r.nearShiftBoundary,1);assert.equal(r.awayFromBoundary,1);assert.equal(r.verifiedStrengthWindows,false);
});
test('invalid event timestamps are skipped',()=>assert.equal(audit([event('20:00','1551')],shifts,22,13).skipped,1));
test('bad shift interval fails closed',()=>assert.equal(audit([], [{teamId:22,playerId:1,start:9,end:8}],22,13).status,'unverified'));
