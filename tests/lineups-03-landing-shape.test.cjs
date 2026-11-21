'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectLandingStatistics:inspect}=require('../scripts/lineups_landing_stats_shape.cjs');
test('shape-only inspection reports keys but no statistics values',()=>{
 const r=inspect({summary:{teamGameStats:[{category:'powerPlayTime',awayValue:'SECRET'}],other:{penaltyTime:'03:00'}}});
 assert.equal(r.status,'shape-only');assert.ok(r.summaryKeys.includes('teamGameStats'));
 assert.equal(JSON.stringify(r).includes('SECRET'),false);assert.equal(JSON.stringify(r).includes('03:00'),false);
});
test('missing summary is unavailable',()=>assert.equal(inspect({}).status,'unavailable'));
