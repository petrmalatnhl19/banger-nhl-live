'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyShiftRows}=require('../scripts/lineups_shiftcharts_rejection_audit.cjs');
const id=2026020335;
const row=(overrides={})=>({gameId:id,playerId:1,teamId:13,period:1,typeCode:517,startTime:'00:01',endTime:'00:40',...overrides});
test('classifies each rejected row once',()=>{
 const data=[row(),row({gameId:123}),row({playerId:null}),row({period:4}),row({typeCode:505}),row({endTime:'99:99'}),row({endTime:'00:00'}),row({endTime:'03:30'})];
 const r=classifyShiftRows({data},id);
 assert.equal(r.accepted,1);assert.equal(r.rejected,7);
 assert.deepEqual(r.normalizationDetails,{over180Seconds:1,outsideRegulation:0,other:0});
 assert.deepEqual(r.reasons,{wrongGame:1,invalidIdentity:1,invalidPeriod:1,nonShiftEvent:1,invalidClock:1,invalidInterval:1,normalizationRejected:1});
});
test('empty or malformed response has no fabricated rejections',()=>{
 assert.equal(classifyShiftRows({},id).status,'invalid-response');
 assert.equal(classifyShiftRows({data:[]},id).rejected,0);
});
