'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {observedFiveSkaterCombinations:calc}=require('../scripts/lineups_five_skater_combinations.cjs');
const row=(id,start=0,end=10,teamId=13)=>({playerId:id,teamId,start,end});
test('counts only exact five-skater overlaps',()=>{
 const r=calc([1,2,3,4,5].map(id=>row(id)).concat(row(6,5,10)),[13,22],10);
 assert.equal(r.teams[0].fiveSkaterSeconds,5);
 assert.deepEqual(r.teams[0].combinations,[{playerIds:[1,2,3,4,5],seconds:5}]);
 assert.equal(r.teams[1].fiveSkaterSeconds,0);assert.equal(r.verifiedUnits,false);
});
test('rejects duplicate shifts without corrupting occupancy',()=>{
 const r=calc([1,2,3,4,5].map(id=>row(id)).concat(row(1)),[13,22],10);
 assert.equal(r.teams[0].rejected,1);assert.equal(r.teams[0].fiveSkaterSeconds,10);
});
test('does not infer 5v5 when only one team has five skaters',()=>{
 const r=calc([1,2,3,4,5].map(id=>row(id)),[13,22],10);
 assert.equal(r.teams[0].fiveSkaterSeconds,10);assert.equal(r.verifiedUnits,false);
});
test('rejects invalid team identifiers',()=>assert.equal(calc([], [13,13]).status,'invalid'));
