'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {eventStrengthEvidence:audit}=require('../scripts/lineups_event_strength_evidence.cjs');
const event=(clock,code)=>({periodDescriptor:{number:1},timeInPeriod:clock,situationCode:code});
const shifts=[...Array.from({length:5},(_,i)=>({teamId:22,playerId:220+i,start:0,end:20})),...Array.from({length:5},(_,i)=>({teamId:13,playerId:130+i,start:0,end:20}))];
test('direct and previous-second evidence remain unverified windows',()=>{
 const r=audit([event('00:10','1551'),event('00:20','1551')],shifts,22,13);
 assert.equal(r.directMatches,1);assert.equal(r.previousSecondOnly,1);assert.equal(r.verifiedStrengthWindows,false);assert.equal(r.verifiedUnits,false);
});
test('unresolved mismatch is not promoted',()=>{
 const r=audit([event('00:10','1451')],shifts,22,13);
 assert.equal(r.unresolved,1);assert.equal(r.directMatches,0);
});
test('previous-second comparison never crosses period boundary',()=>{
 const r=audit([event('00:00','1451')],shifts,22,13);
 assert.equal(r.previousSecondOnly,0);
});
test('duplicate shift fails closed',()=>assert.equal(audit([], [...shifts,shifts[0]],22,13).status,'unverified'));
