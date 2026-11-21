'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditShortGapCoverageNeighbors}=require('../scripts/lineups_03_58_coverage_neighbors.cjs');
const coverage={status:'candidate-only',gaps:[{startSecond:10,endSecondExclusive:12,seconds:2},{startSecond:20,endSecondExclusive:25,seconds:5}]};
const classification={status:'candidate-only',allIntervals:[{category:'fiveVsFiveCount',startSecond:10,endSecondExclusive:12,seconds:2},{category:'fiveVsFiveCount',startSecond:20,endSecondExclusive:21,seconds:1},{category:'fiveVsFiveCount',startSecond:22,endSecondExclusive:23,seconds:1}]};
test('distinguishes both one and neither adjacent coverage',()=>{const r=auditShortGapCoverageNeighbors({classification,coverage});assert.equal(r.bothCoveredSides,1);assert.equal(r.oneCoveredSide,1);assert.equal(r.noCoveredSides,1);assert.equal(r.publishable,false)});
test('rejects interval not inside uncovered gap',()=>{const r=auditShortGapCoverageNeighbors({classification:{...classification,allIntervals:[{category:'fiveVsFiveCount',startSecond:30,endSecondExclusive:31,seconds:1}]},coverage});assert.equal(r.status,'unverified')});
test('rejects overlapping coverage gaps',()=>{const r=auditShortGapCoverageNeighbors({classification,coverage:{...coverage,gaps:[...coverage.gaps,{startSecond:24,endSecondExclusive:26,seconds:2}]}});assert.equal(r.status,'unverified')});
