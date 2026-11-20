'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyLongShiftRoles}=require('../scripts/lineups_game_roster_audit.cjs');
const gameId='2026020335';
const box={awayTeam:{id:22},homeTeam:{id:13},playerByGameStats:{awayTeam:{goalies:[{playerId:10}],forwards:[{playerId:11}],defense:[{playerId:12}]},homeTeam:{goalies:[{playerId:20}],forwards:[{playerId:21}],defense:[{playerId:22}]}}};
const row=(playerId,teamId)=>({gameId:Number(gameId),period:1,typeCode:517,playerId,teamId,startTime:'00:00',endTime:'20:00'});
test('matches long shifts to game-specific goalie and skater roles',()=>{
 const r=verifyLongShiftRoles({data:[row(10,22),row(20,13),row(11,22)]},box,gameId);
 assert.equal(r.status,'roles-checked');assert.equal(r.goalieLongShifts,2);assert.equal(r.skaterLongShifts,1);assert.equal(r.verifiedUnits,false);
});
test('does not invent roles when game roster is missing',()=>assert.equal(verifyLongShiftRoles({data:[row(10,22)]},{},gameId).status,'unverified'));
test('unknown participants stay explicitly partial',()=>{const r=verifyLongShiftRoles({data:[row(99,22)]},box,gameId);assert.equal(r.status,'partial');assert.equal(r.unknownLongShifts,1)});
