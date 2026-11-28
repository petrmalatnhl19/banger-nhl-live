"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const html=read("index.html");
const tv=read("scripts/banger_tv_match_stats.js");
const publicFiles=[
 "security/local/security120-tv-ui-gate.cjs",
 "security/local/security121-tv-e2e-preview.cjs",
 "security/local/security123-public-contract.cjs"
];
assert.match(html,/<script[^>]+src=["']scripts\/banger_tv_match_stats\.js(?:\?[^"']*)?["']/);
for(const p of publicFiles){
 const name=path.basename(p);
 assert(!html.includes(name),"production must not import "+name);
 assert(!tv.includes(name),"legacy TV must not import "+name);
}
for(const source of ["nhl_prediction_archive","core43_shadow_predictions_v1","core43_shadow_preview_v1"])
 assert(tv.includes(source),"legacy dependency changed: "+source);
const gate=read(publicFiles[0]);
assert.match(gate,/DEFAULT_MODE="legacy"/);
assert.match(gate,/mode!=="public-preview"/);
const bridge=read(publicFiles[1]);
assert.match(bridge,/enabled=false/);
assert.match(bridge,/enabled!==true/);
assert(!bridge.includes("fetchLegacy"),"public preview cannot fall back to legacy");
const contract=read(publicFiles[2]);
assert.match(contract,/Object\.freeze/);
const plan=read("docs/security-100-staged-public-api-migration.md");
assert(plan.includes("NO-GO"));
console.log("SECURITY-124 integration gate passed: legacy unchanged, public preview isolated, NO-GO retained");
