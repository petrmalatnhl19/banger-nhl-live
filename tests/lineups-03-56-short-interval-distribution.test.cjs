'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditShortRecoveryIntervals}=require('../scripts/lineups_03_56_short_interval_distribution.cjs');
const classification={status:'candidate-only',categories:{fiveVsFiveCount:18},allIntervals:[{category:'fiveVsFiveCount',startSecond:0,endSecondExclusive:2,seconds:2},{category:'fiveVsFiveCount',startSecond:2,endSecondExclusive:8,seconds:6},{category:'fiveVsFiveCount',startSecond:8,endSecondExclusive:18,seconds:10}]};
test('buckets and thresholds preserve all candidate seconds',()=>{const r=auditShortRecoveryIntervals({classification});assert.deepEqual(r.bands.map(b=>b.seconds),[2,0,6,10]);assert.deepEqual(r.thresholdSummary.map(t=>t.candidateSeconds),[18,16,16,10]);assert.equal(r.publishable,false)});
test('rejects incomplete candidate accounting',()=>{assert.equal(auditShortRecoveryIntervals({classification:{...classification,categories:{fiveVsFiveCount:19}}}).status,'unverified')});
test('rejects invalid thresholds',()=>{assert.equal(auditShortRecoveryIntervals({classification,thresholds:[1,1]}).status,'unverified')});
