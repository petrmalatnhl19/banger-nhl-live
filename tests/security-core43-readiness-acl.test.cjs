"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");
const view="core43_shadow_readiness_v1";
const sql=fs.readFileSync("scripts/sql/security_core43_readiness_revoke_proposal.sql","utf8");
test("readiness ACL proposal changes only a single view and preserves service SELECT",()=>{
 const executable=sql.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");
 assert.match(executable,/REVOKE ALL PRIVILEGES ON TABLE public\.core43_shadow_readiness_v1 FROM anon, authenticated;/);
 assert.match(executable,/GRANT SELECT ON TABLE public\.core43_shadow_readiness_v1 TO service_role;/);
 assert.doesNotMatch(executable,/\b(?:DROP|ALTER|CREATE|UPDATE|INSERT|DELETE|TRUNCATE|SECURITY DEFINER)\b/i);
 assert.equal((executable.match(/\bREVOKE\b/g)||[]).length,1);
});
test("main app does not directly request the internal readiness REST view",()=>{
 const sources=["core-performance.js","scripts/banger_tv_match_stats.js","scripts/core43_verified_dashboard.js"];
 for(const file of sources){
  const src=fs.readFileSync(file,"utf8");
  assert.ok(!src.includes(view+"?"),file+" must not fetch internal readiness view");
 }
});
