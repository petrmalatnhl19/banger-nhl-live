'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditBoundaryAlternatives:audit}=require('../scripts/lineups_boundary_alternatives.cjs');
const event=(time,code)=>({periodDescriptor:{number:1},timeInPeriod:time,situationCode:code,typeDescKey:'penalty'});
const shifts=[...Array.from({length:5},(_,i)=>({teamId:22,playerId:220+i,start:0,end:20})),...Array.from({length:5},(_,i)=>({teamId:13,playerId:130+i,start:0,end:20}))];
test('checks prior second without rewriting event',()=>{
 const r=audit([event('00:20','1551')],shifts,22,13);
 assert.equal(r.mismatches,1);assert.equal(r.previousSecondMatches,1);assert.equal(r.nextSecondMatches,0);assert.equal(r.verifiedStrengthWindows,false);
});
test('does not cross period boundaries',()=>{
 const r=audit([event('00:00','1451')],shifts,22,13);
 assert.equal(r.previousSecondMatches,0);
});
test('bad shift input fails closed',()=>assert.equal(audit([], [{teamId:22,playerId:1,start:4,end:3}],22,13).status,'unverified'));
