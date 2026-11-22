'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditGoalPenaltyInteractions:audit}=require('../scripts/lineups_goal_penalty_interactions.cjs');
const penalty={status:'penalty-context-only',penalties:[{eventId:1,second:100,teamId:13,minutes:2}]};
const goal=(time,team)=>({typeDescKey:'goal',eventId:2,periodDescriptor:{number:1},timeInPeriod:time,details:{eventOwnerTeamId:team}});
test('opponent goal flags possible minor termination, never confirms it',()=>{
 const r=audit([goal('02:00',22)],penalty,22,13);assert.equal(r.interactions[0].flag,'possible-minor-termination');assert.equal(r.interactions[0].verifiedTermination,false);assert.equal(r.publishable,false);
});
test('shorthanded goal does not prove termination',()=>{
 const r=audit([goal('02:00',13)],penalty,22,13);assert.equal(r.interactions[0].flag,'shorthanded-goal-context');
});
test('goal after nominal penalty expiration is excluded',()=>{
 const r=audit([goal('03:40',22)],penalty,22,13);assert.equal(r.interactions.length,0);
});
test('missing evidence fails closed',()=>assert.equal(audit([],{},22,13).status,'unverified'));
