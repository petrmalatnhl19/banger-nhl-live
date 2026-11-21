'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyUncoveredSeconds}=require('../scripts/lineups_03_42_uncovered_classification.cjs');
const shifts=[];
for(const [teamId,ids] of [[22,[1,2,3,4,5]],[13,[11,12,13,14,15]]])for(const playerId of ids)shifts.push({teamId,playerId,start:0,end:10});
const base={awayId:22,homeId:13,regulationSeconds:10,shifts,intervals:[{strength:'5v5',startSecond:2,endSecondExclusive:6}]};
test('classifies uncovered five-skater seconds without promoting to verified',()=>{
 const r=classifyUncoveredSeconds(base);assert.equal(r.status,'candidate-only');assert.deepEqual(r.categories,{fiveVsFiveCount:6,otherSkaterCounts:0,incompleteOrAmbiguous:0});assert.equal(r.uncoveredSeconds,6);assert.equal(r.verifiedStrength,false);
});
test('counts unequal skaters separately and marks uncertain zero or equal non-five',()=>{
 const modified=shifts.map(s=>s.teamId===13&&s.playerId===15?{...s,end:8}:s);
 const r=classifyUncoveredSeconds({...base,shifts:modified});assert.equal(r.categories.otherSkaterCounts,2);assert.equal(r.categories.fiveVsFiveCount,4);
});
test('fails closed on duplicate shifts, overlap and malformed inputs',()=>{
 for(const change of [{shifts:[...shifts,shifts[0]]},{intervals:[...base.intervals,{strength:'5v5',startSecond:5,endSecondExclusive:8}]},{shifts:[...shifts,{teamId:22,playerId:7,start:0,end:11}]},{homeId:22}])assert.equal(classifyUncoveredSeconds({...base,...change}).status,'unverified');
});
