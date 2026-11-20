'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {annotateStrengthUnits:annotate}=require('../scripts/lineups_candidate_strength_names.cjs');
const boxscore={awayTeam:{id:22},homeTeam:{id:13},playerByGameStats:{awayTeam:{forwards:[{playerId:1,name:{default:'Test Forward'},position:'C'}],defense:[]},homeTeam:{forwards:[{playerId:2,name:{default:'Test Skater'},position:'L'}],defense:[]}}};
const input={status:'candidate-only',teams:[{teamId:22,seconds:5,units:[{strength:'5v4',seconds:5,playerIds:[1]}]},{teamId:13,seconds:5,units:[{strength:'5v4',seconds:5,playerIds:[2]}]}]};
test('annotates candidates without confirming PP/PK',()=>{const r=annotate(input,boxscore);assert.equal(r.teams[0].units[0].players[0].name,'Test Forward');assert.equal(r.verifiedUnits,false)});
test('unknown player fails closed',()=>assert.equal(annotate({...input,teams:[{...input.teams[0],units:[{strength:'5v4',seconds:5,playerIds:[999]}]}]},boxscore).status,'unverified'));
test('missing roster fails closed',()=>assert.equal(annotate(input,{}).status,'unverified'));
