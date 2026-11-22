'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {extractRosterSkaterShifts}=require('../scripts/lineups_roster_skater_shifts.cjs');
const gameId='2026020335';
const box={awayTeam:{id:22},homeTeam:{id:13},playerByGameStats:{awayTeam:{goalies:[{playerId:10}],forwards:[{playerId:11}],defense:[{playerId:12}]},homeTeam:{goalies:[{playerId:20}],forwards:[{playerId:21}],defense:[{playerId:22}]}}};
const row=(playerId,teamId,startTime='00:00',endTime='20:00')=>({gameId:Number(gameId),period:1,typeCode:517,playerId,teamId,startTime,endTime});
test('retains short skater shifts and excludes long goalie shifts',()=>{
 const r=extractRosterSkaterShifts({data:[row(10,22),row(20,13),row(11,22,'00:00','00:40'),row(21,13,'00:20','01:00')]},box,gameId);
 assert.equal(r.status,'roster-filtered');assert.equal(r.goalieShiftCount,2);assert.equal(r.skaterShiftCount,2);assert.equal(r.rejected,0);assert.equal(r.verifiedUnits,false);
});
test('long skater shift is rejected, not silently treated as goalie',()=>{
 const r=extractRosterSkaterShifts({data:[row(11,22)]},box,gameId);assert.equal(r.status,'partial');assert.equal(r.rejected,1);
});
test('missing or ambiguous roster fails closed',()=>{
 assert.equal(extractRosterSkaterShifts({data:[]},{},gameId).status,'unverified');
 const bad=structuredClone(box);bad.playerByGameStats.awayTeam.goalies.push({playerId:11});
 assert.equal(extractRosterSkaterShifts({data:[]},bad,gameId).status,'unverified');
});
