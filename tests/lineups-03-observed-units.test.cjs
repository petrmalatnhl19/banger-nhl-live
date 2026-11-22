'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {observedUnits,normalizeShifts}=require('../scripts/lineups_observed_units.cjs');
const teamId=10;
const shifts=[1,2,3,4,5].map(playerId=>({playerId,teamId,start:0,end:60}));
const window=(kind,teamSkaters,opponentSkaters)=>({kind,start:0,end:60,teamSkaters,opponentSkaters});
test('5v4 PP requires explicit strength and returns exact observed overlap',()=>{
  const result=observedUnits({shifts,windows:[window('PP',5,4)],teamId});
  assert.deepEqual(result,[{kind:'PP',playerIds:[1,2,3,4,5],seconds:60}]);
});
test('does not call equal strength PP or PK',()=>{
  assert.deepEqual(observedUnits({shifts,windows:[window('PP',5,5),window('PK',5,5)],teamId}),[]);
});
test('5v5 EV stays separate from special teams',()=>{
  assert.equal(observedUnits({shifts,windows:[window('EV',5,5)],teamId})[0].kind,'EV');
});
test('PK 4v5 and 3v5 are distinguished by observed skaters',()=>{
  const four=shifts.slice(0,4),three=shifts.slice(0,3);
  assert.equal(observedUnits({shifts:four,windows:[window('PK',4,5)],teamId})[0].playerIds.length,4);
  assert.equal(observedUnits({shifts:three,windows:[window('PK',3,5)],teamId})[0].playerIds.length,3);
});
test('4v4 does not count as 5v5',()=>{
  assert.deepEqual(observedUnits({shifts:shifts.slice(0,4),windows:[window('EV',4,4)],teamId}),[]);
});
test('missing strength evidence and partial shifts do not invent combinations',()=>{
  assert.deepEqual(observedUnits({shifts,windows:[],teamId}),[]);
  assert.deepEqual(observedUnits({shifts:shifts.slice(0,4),windows:[window('PP',5,4)],teamId}),[]);
});
test('rejects malformed and implausible shifts',()=>{
  assert.equal(normalizeShifts([{playerId:1,teamId,start:20,end:10},{playerId:1,teamId,start:0,end:900}]).length,0);
});
test('no overlapping interval is double-counted at boundaries',()=>{
  const split=[...shifts.slice(1),{playerId:1,teamId,start:0,end:30},{playerId:1,teamId,start:30,end:60}];
  assert.equal(observedUnits({shifts:split,windows:[window('PP',5,4)],teamId})[0].seconds,60);
});
