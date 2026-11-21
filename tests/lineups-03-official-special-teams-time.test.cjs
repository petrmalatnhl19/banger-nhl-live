'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {officialSpecialTeamsTime:read,parseTime}=require('../scripts/lineups_official_special_teams_time.cjs');
test('strict clock parsing',()=>{assert.equal(parseTime('03:45'),225);assert.equal(parseTime('3:60'),null);assert.equal(parseTime('5/6'),null)});
test('only explicit official PP time yields official total',()=>{
 const r=read({summary:{teamGameStats:[{category:'powerPlayTime',awayValue:'03:45',homeValue:'04:30'}]}},22,13);
 assert.equal(r.verifiedTotalTime,true);assert.equal(r.teams[0].PPSeconds,225);assert.equal(r.teams[0].PKSeconds,270);
});
test('PP opportunities and percent cannot substitute for PP time',()=>{
 const r=read({summary:{teamGameStats:[{category:'powerPlayPct',awayValue:'1/3',homeValue:'0/2'}]}},22,13);
 assert.equal(r.status,'unverified');assert.equal(r.verifiedTotalTime,false);
});
test('missing or malformed official times fail closed',()=>{
 assert.equal(read({},22,13).status,'unverified');
 assert.equal(read({summary:{teamGameStats:[{category:'powerPlayTime',awayValue:'2:00',homeValue:'N/A'}]}},22,13).status,'unverified');
});
