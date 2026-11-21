'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {triageRecoveryBoundaries}=require('../scripts/lineups_03_45_recovery_boundary_triage.cjs');
const w={startSecond:10,endSecondExclusive:30,conflictingEvents:0,pointSupport:2,precedingEvent:{second:9,strength:'5v5'},followingEvent:{second:31,strength:'5v5'}};
test('classifies event-supported gaps conservatively',()=>{const r=triageRecoveryBoundaries({status:'candidate-only',windows:[w]});assert.equal(r.windows[0].classification,'consistent-point-evidence-only');assert.equal(r.publishable,false);assert.equal(r.verifiedStrength,false)});
test('flags special teams boundary transition and interior conflict',()=>{const r=triageRecoveryBoundaries({status:'candidate-only',windows:[{...w,precedingEvent:{second:9,strength:'5v4'}},{...w,conflictingEvents:1}]});assert.deepEqual(r.windows.map(x=>x.classification),['boundary-transition-risk','conflicting-interior-event'])});
test('fails closed on missing or malformed evidence',()=>{assert.equal(triageRecoveryBoundaries({status:'unverified',windows:[w]}).status,'unverified');assert.equal(triageRecoveryBoundaries({status:'candidate-only',windows:[{...w,pointSupport:-1}]}).status,'unverified')});
