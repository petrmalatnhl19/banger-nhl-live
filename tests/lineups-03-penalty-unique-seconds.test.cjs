'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditUniquePenaltyCandidateSeconds:audit}=require('../scripts/lineups_penalty_unique_seconds.cjs');
const p=(second)=>({teamId:13,minutes:2,second,nearbyCandidateWindows:[{startSecond:110,seconds:20,strength:'5v4'}]});
test('overlapping penalties count identical seconds only once',()=>{
 const r=audit({status:'penalty-context-only',penalties:[p(100),p(105)]},22,13);
 assert.equal(r.uniqueCandidateSeconds,20);assert.equal(r.overlappingSeconds,20);assert.equal(r.byAdvantagedTeam[0].uniqueCandidateSeconds,20);assert.equal(r.publishable,false);
});
test('exclude six skaters and opponent advantage',()=>{
 const r=audit({status:'penalty-context-only',penalties:[{...p(100),nearbyCandidateWindows:[{startSecond:110,seconds:20,strength:'5v6'},{startSecond:130,seconds:20,strength:'4v5'}]}]},22,13);
 assert.equal(r.uniqueCandidateSeconds,0);
});
test('invalid evidence fails closed',()=>assert.equal(audit({},22,13).status,'unverified'));
