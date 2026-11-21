'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditRecoveryEventTransitions}=require('../scripts/lineups_03_53_event_transition_audit.cjs');
const segments={status:'candidate-only',segments:[{startSecond:1200,endSecondExclusive:1210}]};
const play=(clock,code)=>({periodDescriptor:{number:2},timeInPeriod:clock,situationCode:code});
test('5v5 points alone never certify continuous strength',()=>{const r=auditRecoveryEventTransitions({segmentAudit:segments,plays:[play('00:01','1551'),play('00:05','1551')]});assert.equal(r.segments[0].classification,'event-points-only');assert.equal(r.verifiedStrength,false)});
test('conflicting strength at same timestamp is flagged',()=>{const r=auditRecoveryEventTransitions({segmentAudit:segments,plays:[play('00:03','1551'),play('00:03','1541')]});assert.equal(r.segments[0].contradictoryTimestampCount,1);assert.equal(r.segments[0].classification,'event-conflict-review')});
test('does not use events from adjacent period',()=>{const r=auditRecoveryEventTransitions({segmentAudit:segments,plays:[{periodDescriptor:{number:1},timeInPeriod:'19:59',situationCode:'1551'}]});assert.equal(r.segments[0].eventCount,0)});
test('rejects cross-period windows',()=>{assert.equal(auditRecoveryEventTransitions({segmentAudit:{status:'candidate-only',segments:[{startSecond:1199,endSecondExclusive:1201}]},plays:[]}).status,'unverified')});
