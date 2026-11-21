'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditGoalStrengthContext:audit}=require('../scripts/lineups_goal_strength_context.cjs');
const interactions={status:'goal-penalty-context',interactions:[{goalEventId:2,penaltyEventId:1,goalSecond:120,scoringTeamId:22}]};
test('candidate 5v4 supports but does not verify PP goal',()=>{
 const r=audit(interactions,[{startSecond:110,endSecondExclusive:130,strength:'5v4'}],22,13);
 assert.equal(r.goals[0].assessment,'power-play-candidate');assert.equal(r.publishable,false);assert.equal(r.goals[0].verified,false);
});
test('5v5 does not support PP goal',()=>{
 const r=audit(interactions,[{startSecond:110,endSecondExclusive:130,strength:'5v5'}],22,13);assert.equal(r.goals[0].assessment,'no-power-play-candidate');
});
test('conflicting and missing windows are not accepted',()=>{
 const windows=[{startSecond:110,endSecondExclusive:130,strength:'5v4'},{startSecond:110,endSecondExclusive:130,strength:'5v5'}];
 assert.equal(audit(interactions,windows,22,13).goals[0].assessment,'conflicting-candidates');
 assert.equal(audit(interactions,[],22,13).goals[0].assessment,'missing-candidate-at-goal');
});
test('missing inputs fail closed',()=>assert.equal(audit({},[],22,13).status,'unverified'));
