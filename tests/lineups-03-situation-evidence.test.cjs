'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditSituationEvidence:audit}=require('../scripts/lineups_situation_evidence_audit.cjs');
test('counts only explicit four-digit event situation codes',()=>{
 const r=audit({id:2026020335,plays:[{periodDescriptor:{number:1},timeInPeriod:'01:20',situationCode:'1551',typeDescKey:'shot-on-goal'},{periodDescriptor:{number:1},situationCode:'1451'},{situationCode:'unknown'},{}]},'2026020335');
 assert.equal(r.status,'event-evidence-only');assert.equal(r.eventCount,4);assert.equal(r.withSituationCode,2);assert.equal(r.byCode['1551'],1);assert.equal(r.verifiedStrengthWindows,false);
});
test('rejects unrelated game',()=>assert.equal(audit({id:1,plays:[]},'2026020335').status,'unverified'));
test('empty event codes cannot verify strength',()=>assert.equal(audit({id:2026020335,plays:[{}]},'2026020335').verifiedStrengthWindows,false));
