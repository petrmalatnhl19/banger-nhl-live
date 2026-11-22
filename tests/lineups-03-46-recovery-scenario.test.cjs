'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {simulateRecoveryCoverage}=require('../scripts/lineups_03_46_recovery_scenario.cjs');
const triage={status:'candidate-only',windows:[{startSecond:10,endSecondExclusive:30,seconds:20,classification:'consistent-point-evidence-only'},{startSecond:50,endSecondExclusive:60,seconds:10,classification:'boundary-transition-risk'}]};
test('scenario is hypothetical and leaves baseline unchanged',()=>{const r=simulateRecoveryCoverage({triage,baselineSeconds:40,regulationSeconds:100});assert.equal(r.baselineSeconds,40);assert.equal(r.possibleCoverageIfConfirmed,60);assert.equal(r.possibleCoverageIncludingRiskIfConfirmed,70);assert.equal(r.publishable,false);assert.equal(r.verifiedStrength,false)});
test('fails closed on overlap and inconsistent totals',()=>{for(const change of [{triage:{...triage,windows:[...triage.windows,{startSecond:20,endSecondExclusive:40,seconds:20,classification:'consistent-point-evidence-only'}]}},{baselineSeconds:95},{triage:{status:'unverified',windows:[]}}])assert.equal(simulateRecoveryCoverage({triage,baselineSeconds:40,regulationSeconds:100,...change}).status,'unverified')});
