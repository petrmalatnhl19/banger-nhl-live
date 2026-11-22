'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {candidateStrengthIntervals:audit}=require('../scripts/lineups_candidate_strength_intervals.cjs');
const event=(clock,code)=>({periodDescriptor:{number:1},timeInPeriod:clock,situationCode:code});
const shifts=[...Array.from({length:5},(_,i)=>({teamId:22,playerId:220+i,start:0,end:30})),...Array.from({length:4},(_,i)=>({teamId:13,playerId:130+i,start:0,end:30}))];
test('matching events with continuous skater counts yield candidate-only interval',()=>{
 const r=audit([event('00:05','1541'),event('00:15','1541')],shifts,22,13);
 assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].seconds,9);assert.equal(r.candidates[0].strength,'5v4');assert.equal(r.verifiedStrengthWindows,false);
});
test('different event strengths do not imply intervals',()=>assert.equal(audit([event('00:05','1541'),event('00:15','1551')],shifts,22,13).candidates.length,0));
test('shift coverage gaps reject candidate',()=>assert.equal(audit([event('00:05','1541'),event('00:35','1541')],shifts,22,13).candidates.length,0));
test('duplicate shifts fail closed',()=>assert.equal(audit([], [...shifts,shifts[0]],22,13).status,'unverified'));
