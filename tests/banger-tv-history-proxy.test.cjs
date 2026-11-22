"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("scripts/banger_tv_match_stats.js","utf8");
test("BANGER TV history is browser-safe and keeps CORE untouched",()=>{
 assert.match(src,/kind=clubhistory/);
 assert.match(src,/kind=boxscore/);
 assert.doesNotMatch(src,/fetch\('https:\/\/api-web\.nhle\.com/);
 assert.match(src,/gameState==='FINAL'/);
 assert.match(src,/Historie alespoň jednoho týmu/);
 new vm.Script(src,{filename:"banger_tv_match_stats.js"});
});
