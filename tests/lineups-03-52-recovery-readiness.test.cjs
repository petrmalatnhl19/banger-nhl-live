'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessRecoveryReadiness}=require('../scripts/lineups_03_52_recovery_readiness.cjs');
const id={status:'candidate-only',segments:[{startSecond:10,endSecondExclusive:12,seconds:2,completeIdentitySeconds:2,ambiguousIdentitySeconds:0}]};
const events={status:'candidate-only',segments:[{startSecond:10,endSecondExclusive:12,seconds:2,pointSupport:1,conflictingEvents:0,classification:'consistent-point-evidence-only'}]};
test('complete identities and matching points do not certify strength',()=>{const r=assessRecoveryReadiness({identityAudit:id,eventAudit:events});assert.equal(r.identityCompleteSeconds,2);assert.equal(r.independentlyVerifiedSeconds,0);assert.equal(r.segments[0].readiness,'independent-strength-required');assert.equal(r.publishable,false)});
test('period boundary requires separate review',()=>{const r=assessRecoveryReadiness({identityAudit:id,eventAudit:{...events,segments:[{...events.segments[0],classification:'period-split-requires-revalidation'}]}});assert.equal(r.segments[0].readiness,'boundary-review-required')});
test('fails closed on mismatched intervals',()=>{const r=assessRecoveryReadiness({identityAudit:id,eventAudit:{...events,segments:[{...events.segments[0],endSecondExclusive:13}]}});assert.equal(r.status,'unverified')});
