"use strict";
const assert=require("node:assert/strict");
const {adapt,FIELDS}=require("../../security/local/security102-tv-adapter.cjs");
const archive=[{game_id:101,game_date:"2026-11-18",away_team:"DAL",home_team:"BOS",core41_away:2.1},{game_id:102}];
const rows=[{game_id:101,core42_away:2,core42_home:3,core43_away:2.2,core43_home:3.3,
core43_preview_away:null,core43_preview_home:0,away_gsax_per100:1.5,home_gsax_per100:null,
internal_goalie_evidence:"SECRET"},{game_id:999,core43_away:99}];
const result=adapt(archive,rows);
assert.equal(result.shadow.length,1);
assert.equal(result.preview.length,1);
assert.equal(result.shadow[0].core43_away,2.2);
assert.equal(result.preview[0].core43_preview_home,0);
assert.equal(result.preview[0].core43_preview_away,null);
assert.ok(!JSON.stringify(result).includes("SECRET"));
assert.deepEqual(FIELDS.length,9);
assert.deepEqual(adapt(archive,[]),{shadow:[],preview:[]});
assert.throws(()=>adapt(archive,[rows[0],rows[0]]),/duplicate/);
assert.throws(()=>adapt([{game_id:101},{game_id:101}],rows),/duplicate/);
assert.throws(()=>adapt(archive,[{...rows[0],core43_away:Infinity}]),/invalid/);
assert.throws(()=>adapt(archive,[{...rows[0],core43_away:"2.2"}]),/invalid/);
assert.throws(()=>adapt(archive,[{...rows[0],game_id:"nope"}]),/invalid/);
console.log("PASS SECURITY-102 TV compatibility adapter (offline, no production UI changes)");
