'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeObservedUnits}=require('../scripts/lineups_observed_pipeline.cjs');
const gameId=2026020335,teamId=13;
const roster={skaters:[1,2,3,4,5],goalies:[99]};
const payload={data:[1,2,3,4,5].map(playerId=>({gameId,teamId,playerId,period:1,typeCode:517,startTime:'01:00',endTime:'01:40'}))};
const windows=[{kind:'PP',start:60,end:100,teamSkaters:5,opponentSkaters:4,verified:true}];
test('candidate-only PP from validated shifts and explicit strength',()=>{
 const r=analyzeObservedUnits({payload,gameId,teamId,roster,windows});
 assert.equal(r.status,'candidate-only');assert.equal(r.units.length,1);
 assert.deepEqual(r.units[0],{kind:'PP',playerIds:[1,2,3,4,5],seconds:40});
});
test('no verified strength means no units',()=>{
 const r=analyzeObservedUnits({payload,gameId,teamId,roster,windows:[{...windows[0],verified:false}]});
 assert.equal(r.status,'unverified');assert.deepEqual(r.units,[]);
});
test('goalies excluded from observed skaters',()=>{
 const withGoalie={data:[...payload.data,{gameId,teamId,playerId:99,period:1,typeCode:517,startTime:'01:00',endTime:'01:40'}]};
 const r=analyzeObservedUnits({payload:withGoalie,gameId,teamId,roster,windows});
 assert.equal(r.units.length,1);assert.equal(r.units[0].playerIds.includes(99),false);
});
test('unknown player and wrong-game rows block candidate output',()=>{
 for(const row of [{...payload.data[0],playerId:88},{...payload.data[0],gameId:2026020336}]){
  const r=analyzeObservedUnits({payload:{data:[...payload.data,row]},gameId,teamId,roster,windows});
  assert.equal(r.status,'unverified');assert.deepEqual(r.units,[]);
 }
});
test('empty source, no windows and bad roster fail closed',()=>{
 assert.equal(analyzeObservedUnits({payload:{data:[]},gameId,teamId,roster,windows}).status,'unverified');
 assert.equal(analyzeObservedUnits({payload,gameId,teamId,roster,windows:[]}).status,'unverified');
 assert.equal(analyzeObservedUnits({payload,gameId,teamId,roster:{skaters:[1,1],goalies:[]},windows}).status,'unverified');
});
