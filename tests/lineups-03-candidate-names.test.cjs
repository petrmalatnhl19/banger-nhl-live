'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {annotateCandidateUnits}=require('../scripts/lineups_candidate_names.cjs');
const box={awayTeam:{id:22},homeTeam:{id:13},playerByGameStats:{awayTeam:{forwards:[{playerId:11,name:{default:'Test Forward'},position:'C'}],defense:[]},homeTeam:{forwards:[{playerId:21,firstName:{default:'Home'},lastName:{default:'Player'},position:'LW'}],defense:[]}}};
test('annotates NHL names without promoting candidate units',()=>{
 const r=annotateCandidateUnits({teams:[{teamId:22,seconds:10,units:[{playerIds:[11,12],seconds:10}]},{teamId:13,seconds:10,units:[{playerIds:[21],seconds:10}]}]},box);
 assert.equal(r.status,'candidate-only');assert.equal(r.verifiedUnits,false);
 assert.equal(r.teams[0].topFive[0].players[0].name,'Test Forward');
 assert.equal(r.teams[0].topFive[0].players[1].name,null);
 assert.equal(r.teams[1].topFive[0].players[0].name,'Home Player');
});
test('missing roster fails closed',()=>assert.equal(annotateCandidateUnits({teams:[]},{}).status,'unverified'));
