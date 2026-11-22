'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {constrainSegmentEventNeighbors}=require('../scripts/lineups_03_50_same_period_neighbors.cjs');
const e=second=>({second,strength:'5v5'});
const audit={status:'candidate-only',segments:[{period:1,startSecond:1137,endSecondExclusive:1200,precedingEvent:e(1108),followingEvent:e(1200)},{period:2,startSecond:1200,endSecondExclusive:1201,precedingEvent:e(1137),followingEvent:e(1206)}]};
test('excludes cross-period neighbors without changing inside event evidence',()=>{const r=constrainSegmentEventNeighbors(audit);assert.equal(r.discardedCrossPeriodNeighborCount,2);assert.equal(r.segments[0].followingEvent,null);assert.equal(r.segments[1].precedingEvent,null);assert.equal(r.segments[0].precedingEvent.second,1108);assert.equal(r.segments[1].followingEvent.second,1206);assert.equal(r.publishable,false)});
test('rejects segment crossing period boundary',()=>{assert.equal(constrainSegmentEventNeighbors({status:'candidate-only',segments:[{period:1,startSecond:1199,endSecondExclusive:1201}]}).status,'unverified')});
test('rejects missing source',()=>{assert.equal(constrainSegmentEventNeighbors({status:'unverified',segments:[]}).status,'unverified')});
