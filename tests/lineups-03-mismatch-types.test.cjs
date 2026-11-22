'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyStrengthMismatchEvents:classify}=require('../scripts/lineups_strength_mismatch_types.cjs');
test('categorizes penalty and goal mismatches without confirming strength',()=>{
 const r=classify({status:'diagnostic-only',mismatches:3,nearShiftBoundary:2,awayFromBoundary:1,examples:[{typeDescKey:'penalty'},{typeDescKey:'goal'},{typeDescKey:'penalty'}]});
 assert.deepEqual(r.byEventType,{penalty:2,goal:1});assert.equal(r.total,3);assert.equal(r.verifiedStrengthWindows,false);
});
test('unverified input fails closed',()=>assert.equal(classify({status:'unverified'}).status,'unverified'));
test('truncated examples are reported explicitly',()=>assert.equal(classify({status:'diagnostic-only',mismatches:2,nearShiftBoundary:2,awayFromBoundary:0,examples:[{typeDescKey:'goal'}]}).examplesTruncated,true));
