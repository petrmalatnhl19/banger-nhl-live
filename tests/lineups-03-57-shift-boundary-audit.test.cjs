'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditShortGapShiftBoundaries}=require('../scripts/lineups_03_57_shift_boundary_audit.cjs');
const classification={status:'candidate-only',allIntervals:[{category:'fiveVsFiveCount',startSecond:10,endSecondExclusive:12,seconds:2},{category:'fiveVsFiveCount',startSecond:20,endSecondExclusive:24,seconds:4}]};
const shifts=[{teamId:1,playerId:10,start:10,end:12},{teamId:2,playerId:20,start:11,end:13}];
test('detects exact matching shift boundaries',()=>{const r=auditShortGapShiftBoundaries({classification,shifts});assert.equal(r.shortIntervalCount,1);assert.equal(r.exactBothBoundariesCount,1);assert.equal(r.shortIntervalSeconds,2);assert.equal(r.publishable,false)});
test('nearby but nonexact shift boundaries remain distinct',()=>{const r=auditShortGapShiftBoundaries({classification,shifts:[{teamId:1,playerId:10,start:9,end:13}]});assert.equal(r.bothBoundariesNearCount,1);assert.equal(r.exactBothBoundariesCount,0)});
test('invalid shift fails closed',()=>{assert.equal(auditShortGapShiftBoundaries({classification,shifts:[{teamId:1,playerId:10,start:10,end:10}]}).status,'unverified')});
test('empty shifts do not imply boundary coincidence',()=>{const r=auditShortGapShiftBoundaries({classification,shifts:[]});assert.equal(r.bothBoundariesNearCount,0)});
