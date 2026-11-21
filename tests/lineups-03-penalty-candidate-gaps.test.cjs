'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditUnattributedSpecialTeamsCandidates:audit}=require('../scripts/lineups_penalty_candidate_gaps.cjs');
const windows=[{startSecond:110,endSecondExclusive:130,strength:'5v4'},{startSecond:230,endSecondExclusive:240,strength:'5v4'},{startSecond:250,endSecondExclusive:260,strength:'5v6'}];
const evidence={status:'penalty-context-only',penalties:[{teamId:13,minutes:2,second:100}]};
test('reports uncovered candidate seconds and excludes empty-net six skaters',()=>{
 const r=audit(windows,evidence,22,13);assert.deepEqual(r.byTeam[0],{teamId:22,candidateSeconds:30,withinMinorPenaltyContextSeconds:20,unattributedCandidateSeconds:10});assert.equal(r.publishable,false);
});
test('overlapping windows are deduplicated by second',()=>{
 const r=audit([...windows,windows[0]],evidence,22,13);assert.equal(r.byTeam[0].candidateSeconds,30);
});
test('missing evidence fails closed',()=>assert.equal(audit(windows,{},22,13).status,'unverified'));
