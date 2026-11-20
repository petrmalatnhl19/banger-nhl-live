'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summarizeSpecialTeamsCandidates:summarize}=require('../scripts/lineups_special_teams_candidate_summary.cjs');
const players=n=>Array.from({length:n},(_,i)=>({playerId:i+1,name:'Player '+(i+1),position:'C'}));
const unit=(strength,n)=>({strength,seconds:20,players:players(n)});
const data={status:'candidate-only',teams:[{teamId:22,units:[unit('5v4',5),unit('4v5',4),unit('5v6',5)]},{teamId:13,units:[unit('5v4',4),unit('4v5',5),unit('5v6',6)]}]};
test('correctly reverses PP/PK for home and away and excludes six skaters',()=>{
 const r=summarize(data,22,13);
 assert.equal(r.status,'candidate-only');assert.equal(r.publishable,false);assert.equal(r.verifiedUnits,false);
 assert.equal(r.teams[0].PP.length,1);assert.equal(r.teams[0].PK.length,1);
 assert.equal(r.teams[1].PP.length,1);assert.equal(r.teams[1].PK.length,1);
 assert.equal(r.teams[0].PP[0].players.length,5);assert.equal(r.teams[1].PK[0].players.length,4);
});
test('unresolved player name fails closed',()=>{
 const bad=structuredClone(data);bad.teams[0].units[0].players[0].name=null;
 assert.equal(summarize(bad,22,13).status,'unverified');
});
test('unverified input never becomes publishable',()=>assert.equal(summarize({status:'unverified',teams:[]},22,13).publishable,false));
