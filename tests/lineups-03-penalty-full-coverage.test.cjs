'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditPenaltyEvidence}=require('../scripts/lineups_penalty_evidence_audit.cjs');
const {auditUniquePenaltyCandidateSeconds}=require('../scripts/lineups_penalty_unique_seconds.cjs');
test('more than 15 strength windows remain available for complete deduplication',()=>{
 const plays=[{typeDescKey:'penalty',eventId:1,periodDescriptor:{number:1},timeInPeriod:'01:00',details:{eventOwnerTeamId:13,duration:2}}];
 const windows=Array.from({length:20},(_,i)=>({startSecond:61+i*3,endSecondExclusive:64+i*3,strength:'5v4'}));
 const evidence=auditPenaltyEvidence(plays,windows,22,13);
 assert.equal(evidence.penalties[0].nearbyCandidateWindows.length,20);
 const result=auditUniquePenaltyCandidateSeconds(evidence,22,13);
 assert.equal(result.uniqueCandidateSeconds,60);
 assert.equal(result.publishable,false);
});
