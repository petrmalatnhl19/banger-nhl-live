'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {candidateFiveUnits:calc}=require('../scripts/lineups_candidate_five_units.cjs');
const rows=(teamId,n,start=0,end=10)=>Array.from({length:n},(_,i)=>({teamId,playerId:teamId*100+i,start,end}));
test('ranks five-skater units within candidate windows only',()=>{
 const r=calc([...rows(13,5),...rows(22,5)],[{start:2,end:8}],[13,22]);
 assert.equal(r.status,'candidate-only');assert.equal(r.teams[0].seconds,6);assert.equal(r.teams[0].units[0].seconds,6);assert.equal(r.verifiedUnits,false);
});
test('rejects windows claiming five skaters where only four are present',()=>{
 assert.equal(calc([...rows(13,4),...rows(22,5)],[{start:0,end:10}],[13,22]).status,'unverified');
});
test('rejects overlapping windows',()=>{
 assert.equal(calc([], [{start:0,end:5},{start:4,end:8}],[13,22]).status,'unverified');
});
