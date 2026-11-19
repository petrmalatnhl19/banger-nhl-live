"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {check,VERSION}=require("../../security/local/security118-tv-freshness.cjs");
const metadata=[{game_id:101,game_date:"2026-11-17",away_team:"DAL",home_team:"FLA",status:"pending"}];
const predictions=[{game_id:101,core42_away:0,core42_home:1,core43_away:2,core43_home:3}];
const now=Date.parse("2026-11-17T10:00:00Z");
const input={metadata,predictions,metadataAsOf:"2026-11-17T09:59:00Z",predictionsAsOf:"2026-11-17T09:58:30Z",metadataVersion:VERSION,predictionsVersion:VERSION,now};
const result=check(input);
assert.equal(result.complete,true);assert.equal(result.rows[0].core42_away,0);
assert.equal(result.as_of,"2026-11-17T09:58:30.000Z");
for(const patch of [
 {metadataAsOf:"2026-11-17T09:50:00Z"},
 {predictionsAsOf:"2026-11-17T10:00:01Z"},
 {metadataAsOf:"2026-11-17T09:59:00+00:00"},
 {metadataAsOf:"2026-02-30T09:59:00Z"},
 {metadataVersion:"old"},
 {predictionsVersion:"other"},
 {predictionsAsOf:"2026-11-17T09:55:00Z"},
 {predictions:[]},
 {predictions:[{...predictions[0],game_id:999}]},
 {maxAgeMs:0},
 {now:NaN}
])assert.throws(()=>check({...input,...patch}));
const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
assert(!html.includes("security118-tv-freshness.cjs"));
console.log("PASS SECURITY-118 UTC freshness, version, skew, completeness and isolation");
