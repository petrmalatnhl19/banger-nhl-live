'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditRecoveryEventGaps}=require('../scripts/lineups_03_54_event_gap_audit.cjs');
const segmentAudit={status:'candidate-only',segments:[{startSecond:1200,endSecondExclusive:1210}]};
const play=(timeInPeriod)=>({periodDescriptor:{number:2},timeInPeriod,situationCode:'1551'});
test('measures boundary and interior event time gaps',()=>{const r=auditRecoveryEventGaps({segmentAudit,plays:[play('00:02'),play('00:06')]});assert.deepEqual(r.segments[0].eventTimeGapsSeconds,[2,4,4]);assert.equal(r.segments[0].longestUnobservedSpanSeconds,4);assert.equal(r.publishable,false)});
test('deduplicates events at the same timestamp',()=>{const r=auditRecoveryEventGaps({segmentAudit,plays:[play('00:02'),play('00:02')]});assert.equal(r.segments[0].distinctFiveOnFiveEventSeconds,1)});
test('no event leaves entire interval unobserved',()=>{const r=auditRecoveryEventGaps({segmentAudit,plays:[]});assert.equal(r.segments[0].longestUnobservedSpanSeconds,10)});
test('rejects cross-period windows',()=>{assert.equal(auditRecoveryEventGaps({segmentAudit:{status:'candidate-only',segments:[{startSecond:1199,endSecondExclusive:1201}]},plays:[]}).status,'unverified')});
