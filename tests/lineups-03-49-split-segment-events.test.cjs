'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditSplitSegmentEvents}=require('../scripts/lineups_03_49_split_segment_events.cjs');
const source={status:'candidate-only',segments:[{startSecond:1137,endSecondExclusive:1200,seconds:63,period:1,classification:'period-split-requires-revalidation',sourceClassification:'period-boundary-risk'},{startSecond:1200,endSecondExclusive:1201,seconds:1,period:2,classification:'period-split-requires-revalidation',sourceClassification:'period-boundary-risk'}]};
const event=(period,timeInPeriod,situationCode)=>({periodDescriptor:{number:period},timeInPeriod,situationCode});
test('event evidence does not transfer across period boundary',()=>{const r=auditSplitSegmentEvents({periodSegments:source,plays:[event(1,'19:30','1551'),event(2,'00:05','1551')]});assert.deepEqual(r.segments.map(s=>s.pointSupport),[1,0]);assert.equal(r.splitWithoutEventCount,1);assert.equal(r.publishable,false)});
test('counts second period opening event only in second segment',()=>{const r=auditSplitSegmentEvents({periodSegments:source,plays:[event(2,'00:00','1551')]});assert.deepEqual(r.segments.map(s=>s.pointSupport),[0,1]);assert.equal(r.verifiedStrength,false)});
test('fails closed without valid split evidence',()=>{assert.equal(auditSplitSegmentEvents({periodSegments:{status:'unverified',segments:[]},plays:[]}).status,'unverified')});
