'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {candidateStrengthUnits:audit}=require('../scripts/lineups_candidate_strength_units.cjs');
const shifts=[...Array.from({length:5},(_,i)=>({teamId:22,playerId:220+i,start:0,end:30})),...Array.from({length:4},(_,i)=>({teamId:13,playerId:130+i,start:0,end:30}))];
const interval={startSecond:6,endSecondExclusive:15,strength:'5v4'};
test('aggregates exact skaters separately for away PP and home PK candidates',()=>{
 const r=audit(shifts,[interval],22,13);
 assert.equal(r.status,'candidate-only');assert.equal(r.verifiedUnits,false);
 assert.equal(r.teams[0].units[0].playerIds.length,5);assert.equal(r.teams[1].units[0].playerIds.length,4);
 assert.equal(r.teams[0].units[0].seconds,9);assert.equal(r.teams[1].units[0].seconds,9);
});
test('gaps in shift coverage fail closed',()=>assert.equal(audit(shifts,[{...interval,endSecondExclusive:31}],22,13).status,'unverified'));
test('overlapping intervals fail closed',()=>assert.equal(audit(shifts,[interval,{startSecond:10,endSecondExclusive:18,strength:'5v4'}],22,13).status,'unverified'));
test('duplicate shifts fail closed',()=>assert.equal(audit([...shifts,shifts[0]],[interval],22,13).status,'unverified'));
