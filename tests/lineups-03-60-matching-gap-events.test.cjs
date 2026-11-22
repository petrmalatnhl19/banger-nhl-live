'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditMatchingShortGapEvents}=require('../scripts/lineups_03_60_matching_gap_events.cjs');
const identityAudit={status:'candidate-only',intervals:[{startSecond:10,endSecondExclusive:11,seconds:1,classification:'matchingBothTeams'},{startSecond:20,endSecondExclusive:21,seconds:1,classification:'changedAtLeastOneTeam'}]};
const play=(t,code='1551')=>({periodDescriptor:{number:1},timeInPeriod:'00:'+String(t).padStart(2,'0'),situationCode:code});
test('no interior event is not promoted to verified strength',()=>{const r=auditMatchingShortGapEvents({identityAudit,plays:[play(9),play(11)]});assert.equal(r.matchingIntervals,1);assert.equal(r.noInteriorEventIntervals,1);assert.equal(r.matchingWithBothSamePeriodNeighborsFiveOnFive,1);assert.equal(r.publishable,false)});
test('conflicting event point is flagged',()=>{const r=auditMatchingShortGapEvents({identityAudit,plays:[play(10,'1451')]});assert.equal(r.conflictingEventIntervals,1)});
test('invalid input fails closed',()=>{assert.equal(auditMatchingShortGapEvents({identityAudit,plays:null}).status,'unverified')});
