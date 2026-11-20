'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summarizeSkaterOccupancy}=require('../scripts/lineups_skater_occupancy_audit.cjs');
test('counts half-open occupancy per team independently',()=>{
 const r=summarizeSkaterOccupancy([{teamId:13,playerId:1,start:0,end:5},{teamId:13,playerId:2,start:3,end:8},{teamId:22,playerId:3,start:0,end:10}],[13,22],10);
 assert.deepEqual(r.teams[0].histogram,{'0':2,'1':6,'2':2});
 assert.deepEqual(r.teams[1].histogram,{'1':10});assert.equal(r.verifiedStrength,false);
});
test('flags duplicate intervals and excessive occupancy without inventing strength',()=>{
 const shifts=Array.from({length:7},(_,i)=>({teamId:13,playerId:i+1,start:0,end:10}));
 shifts.push(shifts[0]);
 const r=summarizeSkaterOccupancy(shifts,[13,22],10);
 assert.equal(r.teams[0].overCapacitySeconds,10);assert.equal(r.teams[0].invalidShiftCount,1);
});
test('rejects invalid inputs',()=>assert.equal(summarizeSkaterOccupancy([],[],10).status,'invalid'));
