"use strict";
// SECURITY-100: fail-closed static rollout guard; does not connect to production.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const plan = fs.readFileSync("docs/security-100-staged-public-api-migration.md", "utf8");
const tv = fs.readFileSync("scripts/banger_tv_match_stats.js", "utf8");
const fixture = fs.readFileSync("security/local/security99-public-api.sql", "utf8");
assert.match(plan, /NO-GO for production revocation/);
assert.match(plan, /explicit approval/);
assert.match(plan, /rollback/i);
assert.match(plan, /current TV Match Stats frontend/i);
assert.match(tv, /core43_shadow_predictions_v1/);
assert.match(tv, /core43_shadow_preview_v1/);
assert.match(fixture, /CREATE TABLE public\.security99_tv_public_v1/);
assert.doesNotMatch(fixture, /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.core43_tv_public_v1/i);
console.log("PASS SECURITY-100: rollout NO-GO until frontend migration and real endpoint exist");
