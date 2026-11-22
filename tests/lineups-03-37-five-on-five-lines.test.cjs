'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {extractFiveOnFiveLines}=require('../scripts/lineups_03_37_five_on_five_lines.cjs');
const roster={awayTeam:{id:22},homeTeam:{id:13},playerByGameStats:{
 awayTeam:{forwards:[1,2,3].map(playerId=>({playerId,name:{default:'EDM '+playerId}})),defense:[4,5].map(playerId=>({playerId,name:{default:'EDM '+playerId}})),goalies:[{playerId:6}]},
 homeTeam:{forwards:[11,12,13].map(playerId=>({playerId,name:{default:'FLA '+playerId}})),defense:[14,15].map(playerId=>({playerId,name:{default:'FLA '+playerId}})),goalies:[{playerId:16}]}
}};
const shifts=[1,2,3,4,5].map(playerId=>({teamId:22,playerId,start:0,end:20})).concat([11,12,13,14,15].map(playerId=>({teamId:13,playerId,start:0,end:20})));
const base={boxscore:roster,shifts,intervals:[{strength:'5v5',startSecond:2,endSecondExclusive:12}]};
test('separates actual five skaters into forward trio and defence pair',()=>{
 const r=extractFiveOnFiveLines(base);assert.equal(r.status,'candidate-only');
 for(const team of r.teams){assert.equal(team.candidateSeconds,10);assert.equal(team.forwardTrios[0].seconds,10);assert.equal(team.defencePairs[0].seconds,10);assert.equal(team.forwardTrios[0].playerIds.length,3);assert.equal(team.defencePairs[0].playerIds.length,2)}
 assert.equal(r.publishable,false);assert.equal(r.verifiedUnits,false);
});
test('fail closed on incomplete, duplicated or nonstandard deployment',()=>{
 for(const changed of [{shifts:shifts.slice(1)},{shifts:[...shifts,shifts[0]]},{shifts:shifts.map(s=>s.playerId===3?{...s,playerId:4}:s)},{intervals:[{strength:'5v4',startSecond:2,endSecondExclusive:12}]},{boxscore:null}]){
  assert.equal(extractFiveOnFiveLines({...base,...changed}).status,'unverified');
 }
});
test('only eligible candidate windows are counted, not whole-game shifts',()=>{
 const r=extractFiveOnFiveLines({...base,intervals:[{strength:'5v5',startSecond:5,endSecondExclusive:7}]});
 assert.equal(r.teams[0].candidateSeconds,2);assert.equal(r.teams[1].defencePairs[0].seconds,2);
});

test('nonstandard positional seconds are excluded without discarding valid 5v5 time',()=>{
 const boxscore=structuredClone(roster);
 boxscore.playerByGameStats.awayTeam.defense.push({playerId:7,name:{default:'EDM 7'}});
 const altered=shifts.map(s=>s.teamId===22&&s.playerId===3?{...s,end:10}:s);
 altered.push({teamId:22,playerId:7,start:10,end:20});
 const result=extractFiveOnFiveLines({boxscore,shifts:altered,intervals:[{strength:'5v5',startSecond:2,endSecondExclusive:18}]});
 assert.equal(result.status,'candidate-only');
 assert.equal(result.teams[0].candidateSeconds,8);
 assert.equal(result.teams[0].skippedNonstandardSeconds,8);
 assert.equal(result.teams[1].candidateSeconds,16);
 assert.equal(result.teams[0].forwardTrios[0].seconds,8);
 assert.equal(result.verifiedUnits,false);
});
