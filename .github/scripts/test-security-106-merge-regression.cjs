"use strict";
// SECURITY-106: verify the post-merge frontend workflow retained BOTH sides.
// This is an offline structural regression guard, not a live deployment test.
const fs=require("node:fs");
const assert=require("node:assert/strict");
const workflow=fs.readFileSync(".github/workflows/frontend-smoke.yml","utf8");
const tv=fs.readFileSync("scripts/banger_tv_match_stats.js","utf8");
const html=fs.readFileSync("index.html","utf8");
for(const required of [
 "name: Frontend smoke checks",
 "pull_request:",
 "workflow_dispatch:",
 "security-01-public-grants-review",
 "node .github/scripts/test-security-105-tv-frontend-regression.cjs",
 "node --test scripts/test_commentary_facts.cjs",
 "Validate local scripts and HTML entrypoint",
 "browser-smoke:"
]) assert.ok(workflow.includes(required),"Merged workflow lost: "+required);
for(const marker of ["<<<<<<<","=======",">>>>>>>"]){
 assert.ok(!workflow.split("\n").some(line=>line.trimStart().startsWith(marker)),
  "Unresolved merge marker: "+marker);
}
assert.ok(fs.existsSync("scripts/test_commentary_facts.cjs"),"Main commentary test missing");
assert.ok(fs.existsSync(".github/scripts/test-security-105-tv-frontend-regression.cjs"),"Security TV test missing");
assert.ok(html.includes("scripts/banger_tv_match_stats.js"),"TV entrypoint lost");
assert.ok(tv.includes("core43_shadow_predictions_v1"),"Production legacy source unexpectedly changed");
assert.ok(tv.includes("core43_shadow_preview_v1"),"Production preview source unexpectedly changed");
console.log("PASS SECURITY-106 merged frontend workflow retains both test suites and TV legacy contract");
