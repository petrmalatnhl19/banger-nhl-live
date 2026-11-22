'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditRecoveryCandidates}=require('../scripts/lineups_03_43_recovery_candidates.cjs');
const base={status:'candidate-only',topIntervals:[{category:'fiveVsFiveCount',startSecond:10,endSecondExclusive:30,seconds:20},{category:'otherSkaterCounts',startSecond:30,endSecondExclusive:80,seconds:50},{category:'fiveVsFiveCount',startSecond:80,endSecondExclusive:83,seconds:3}]};
test('prioritizes only long shift-count 5v5 gaps',()=>{const r=auditRecoveryCandidates({classification:base});assert.equal(r.status,'candidate-only');assert.equal(r.recoveryCandidates.length,1);assert.equal(r.listedCandidateSeconds,20);assert.equal(r.publishable,false);assert.equal(r.sourceTruncated,true)});
test('does not accept unverified source or invalid intervals',()=>{assert.equal(auditRecoveryCandidates({classification:{...base,status:'unverified'}}).status,'unverified');assert.equal(auditRecoveryCandidates({classification:{...base,topIntervals:[{category:'fiveVsFiveCount',startSecond:1,endSecondExclusive:10,seconds:10}]}}).status,'unverified')});
