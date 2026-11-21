'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {publicSpecialTeamsView:view}=require('../scripts/lineups_public_special_teams_gate.cjs');
const candidates={status:'candidate-only',publishable:false,verifiedUnits:false,teams:[{teamId:22,PP:[{players:[{name:'C. McDavid'}],seconds:153}],PK:[]}]};
const coverage={status:'candidate-only',publishable:false,verifiedUnits:false,teams:[{teamId:22,PP:{topUnitShareOfCandidateSeconds:1}}]};
test('candidate-only data never leaks player identities to public view',()=>{
 const result=view(candidates,coverage);assert.equal(result.status,'unavailable');assert.deepEqual(result.PP,[]);assert.deepEqual(result.PK,[]);assert.equal(JSON.stringify(result).includes('McDavid'),false);
});
test('missing and contradictory verification flags fail closed',()=>{
 assert.equal(view(null,coverage).status,'unavailable');
 assert.equal(view({...candidates,publishable:true},coverage).status,'unavailable');
 assert.equal(view(candidates,{...coverage,verifiedUnits:true}).status,'unavailable');
});
