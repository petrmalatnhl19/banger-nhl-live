"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {present,STATES}=require("../../security/local/security119-tv-failclosed-state.cjs");
const {VERSION}=require("../../security/local/security118-tv-freshness.cjs");
const metadata=[{game_id:101,game_date:"2026-11-17",away_team:"DAL",home_team:"FLA",status:"pending"}];
const predictions=[{game_id:101,core42_away:0,core42_home:1,core43_away:2,core43_home:3}];
const good={metadata,predictions,metadataAsOf:"2026-11-17T09:59:00Z",predictionsAsOf:"2026-11-17T09:59:00Z",metadataVersion:VERSION,predictionsVersion:VERSION,now:Date.parse("2026-11-17T10:00:00Z")};
const ready=present(good);
assert.equal(ready.state,STATES.READY);assert.equal(ready.rows[0].core42_away,0);
for(const [patch,state] of [
 [{metadataAsOf:"2026-11-17T09:40:00Z"},STATES.STALE],
 [{predictionsAsOf:"2026-11-17T10:00:01Z"},STATES.STALE],
 [{predictions:[]},STATES.INCOMPLETE],
 [{metadataVersion:"wrong"},STATES.INVALID],
 [{predictions:[{...predictions[0],core43_away:Infinity}]},STATES.INVALID],
 [{metadata:null},STATES.UNAVAILABLE],
 [{predictions:null},STATES.UNAVAILABLE],
 [{metadataAsOf:"not-a-date"},STATES.INVALID]
]){
 const actual=present({...good,...patch});assert.equal(actual.state,state);
 assert.deepEqual(actual.rows,[]);assert.equal(actual.as_of,null);
 assert.equal(actual.snapshot_version,null);
}
assert.deepEqual(present(undefined).rows,[]);
const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
assert(!html.includes("security119-tv-failclosed-state.cjs"));
console.log("PASS SECURITY-119 fail-closed TV presentation states and production isolation");
