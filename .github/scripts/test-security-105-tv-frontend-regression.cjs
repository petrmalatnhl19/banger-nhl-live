"use strict";
// SECURITY-105: regression guard for the CURRENT real TV frontend.
// Static inspection only: NOT a browser rendering test or production API migration.
const fs=require("node:fs"),assert=require("node:assert/strict");
const source=fs.readFileSync("scripts/banger_tv_match_stats.js","utf8");
const html=fs.readFileSync("index.html","utf8");
assert.match(html,/scripts\/banger_tv_match_stats\.js/,"TV script remains mounted");
for(const field of ["core42_away","core42_home","core43_away","core43_home",
 "core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"]){
 assert.ok(source.includes(field),"TV missing field "+field);
}
for(const label of ["CORE 4.2 · góly","CORE 4.3 · ověřený",
 "CORE 4.3 · náhled","GSAx / 100 · vstup"]){
 assert.ok(source.includes(label),"TV missing rendered row "+label);
}
assert.match(source,/const safe=v=>/,"escaping helper must remain");
assert.match(source,/safe\(g\.away_team\)/,"away name must be escaped");
assert.match(source,/safe\(g\.home_team\)/,"home name must be escaped");
assert.match(source,/a\.core42_away\?\?g\.core42_away/,"archive CORE42 fallback must remain");
assert.match(source,/a\.core42_home\?\?g\.core42_home/,"archive CORE42 fallback must remain");
assert.match(source,/fetchRows\('core43_shadow_predictions_v1/,"legacy reads remain until explicit migration");
assert.match(source,/fetchRows\('core43_shadow_preview_v1/,"legacy reads remain until explicit migration");
assert.doesNotMatch(source,/security101_tv_public_v1/,"synthetic endpoint must not be wired to production");
assert.doesNotMatch(source,/security103-tv-rollout/,"offline module must not be imported by production");
console.log("PASS SECURITY-105 actual TV frontend static regression and no premature migration");
