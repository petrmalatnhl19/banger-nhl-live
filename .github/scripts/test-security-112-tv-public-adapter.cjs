"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {adapt,FIELDS} = require("../../security/local/security102-tv-adapter.cjs");
const expected=["game_id","core42_away","core42_home","core43_away","core43_home","core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"];
assert.deepEqual(FIELDS,expected);
const archive=[{game_id:101,game_date:"2026-11-18",away_team:"DAL",home_team:"BOS"}];
const sample={game_id:101,core42_away:0,core42_home:2.5,core43_away:3,core43_home:null,core43_preview_away:0,core43_preview_home:4,away_gsax_per100:null,home_gsax_per100:1.25,private_goalie:"SECRET"};
const output=adapt(archive,[sample]);
assert.equal(output.shadow[0].core42_away,0);
assert.equal(output.shadow[0].core43_home,null);
assert.equal(output.preview[0].core43_preview_away,0);
assert.equal(output.preview[0].away_gsax_per100,null);
assert(!JSON.stringify(output).includes("SECRET"));
assert.deepEqual(adapt(archive,[]),{shadow:[],preview:[]});
for(const invalid of [Infinity,-Infinity,NaN,"3",{},true]){
 assert.throws(()=>adapt(archive,[{...sample,core43_away:invalid}]),/invalid/);
}
assert.throws(()=>adapt(archive,[sample,sample]),/duplicate/);
assert.throws(()=>adapt([...archive,...archive],[sample]),/duplicate/);
assert.throws(()=>adapt(archive,[{...sample,game_id:0}]),/invalid/);
assert.throws(()=>adapt(archive,null),TypeError);
// Production must not select the experimental endpoint or import the offline adapter.
const frontend=fs.readFileSync(path.join(__dirname,"../../scripts/banger_tv_match_stats.js"),"utf8");
assert(!frontend.includes("security102-tv-adapter"));
assert(!frontend.includes("security112-tv-public-adapter"));
assert(!frontend.includes("security99_tv_public_v1"));
assert(!frontend.includes("TV_PUBLIC_API_ENABLED=true"));
console.log("PASS SECURITY-112: strict public field contract, invalid/duplicate isolation, default-off production guard");
