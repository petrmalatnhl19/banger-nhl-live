"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {FIELDS,project}=require("../../security/local/security116-tv-metadata.cjs");
const good={game_id:2026020335,game_date:"2026-11-17",away_team:"DAL",home_team:"FLA",status:"pending",private_secret:"never expose",core43_away:8};
const out=project([good]);
assert.deepEqual(Object.keys(out[0]),FIELDS);
assert.equal(out[0].game_date,"2026-11-17");
assert(!JSON.stringify(out).includes("never expose"));
for(const row of [
 {...good,game_id:0},{...good,game_id:"2026020335"},{...good,game_date:"2026-02-30"},
 {...good,game_date:"yesterday"},{...good,away_team:"Dallas"},
 {...good,home_team:"DAL"},{...good,status:"final"},
 {...good,status:null}
])assert.throws(()=>project([row]),/invalid/);
assert.throws(()=>project([good,good]),/duplicate/);
assert.throws(()=>project(Array(41).fill(good)),/invalid/);
const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
assert(!html.includes("security116-tv-metadata.cjs"));
console.log("PASS SECURITY-116 offline metadata projection and production isolation");
