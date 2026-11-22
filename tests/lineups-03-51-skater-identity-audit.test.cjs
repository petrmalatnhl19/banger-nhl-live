'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditRecoverySkaterIdentities}=require('../scripts/lineups_03_51_skater_identity_audit.cjs');
const segmentAudit={status:'candidate-only',segments:[{startSecond:10,endSecondExclusive:12}]};
const shifts=[...[1,2,3,4,5].map(playerId=>({teamId:1,playerId,start:10,end:12})),...[6,7,8,9,10].map(playerId=>({teamId:2,playerId,start:10,end:12}))];
test('counts five distinct roster skaters on both teams',()=>{const r=auditRecoverySkaterIdentities({segmentAudit,shifts,awayId:1,homeId:2});assert.equal(r.segments[0].completeIdentitySeconds,2);assert.equal(r.segments[0].distinctCombinedUnits,1);assert.equal(r.publishable,false)});
test('flags duplicate overlapping shift for one player',()=>{const r=auditRecoverySkaterIdentities({segmentAudit,shifts:[...shifts,{teamId:1,playerId:1,start:10,end:12}],awayId:1,homeId:2});assert.equal(r.segments[0].ambiguousIdentitySeconds,2);assert.equal(r.segments[0].identityCoverageComplete,false)});
test('fails closed on missing source and invalid shifts',()=>{assert.equal(auditRecoverySkaterIdentities({segmentAudit:{status:'unverified',segments:[]},shifts,awayId:1,homeId:2}).status,'unverified');assert.equal(auditRecoverySkaterIdentities({segmentAudit,shifts:[...shifts,{teamId:1,playerId:12,start:12,end:12}],awayId:1,homeId:2}).status,'unverified')});
