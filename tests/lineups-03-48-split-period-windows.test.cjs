'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {splitRecoveryPeriodWindows}=require('../scripts/lineups_03_48_split_period_windows.cjs');
const audit={status:'candidate-only',windows:[{startSecond:1137,endSecondExclusive:1201,seconds:64,classification:'period-boundary-risk',crossesPeriod:true},{startSecond:2410,endSecondExclusive:2566,seconds:156,classification:'consistent-point-evidence-only',crossesPeriod:false}]};
test('splits crossing window into 63 seconds and one second',()=>{const r=splitRecoveryPeriodWindows({audit});assert.deepEqual(r.segments.slice(0,2).map(x=>[x.period,x.seconds]),[[1,63],[2,1]]);assert.equal(r.totalSeconds,220);assert.equal(r.splitSegmentCount,2);assert.equal(r.publishable,false)});
test('preserves within-period window',()=>{const r=splitRecoveryPeriodWindows({audit});assert.equal(r.segments[2].seconds,156);assert.equal(r.segments[2].classification,'consistent-point-evidence-only')});
test('rejects invalid source and window',()=>{assert.equal(splitRecoveryPeriodWindows({audit:{status:'unverified',windows:[]}}).status,'unverified');assert.equal(splitRecoveryPeriodWindows({audit:{status:'candidate-only',windows:[{startSecond:1199,endSecondExclusive:1201,seconds:3}]}}).status,'unverified')});
