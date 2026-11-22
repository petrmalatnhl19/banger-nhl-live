"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("scripts/banger_tv_match_stats.js", "utf8");
assert.ok(source.includes("Načtení TV statistik se nepodařilo. Zkuste to později."), "generic user-facing failure is required");
assert.ok(!source.includes("Načtení TV statistik selhalo: '+e.message"), "raw exception details must not reach TV UI");
console.log("SECURITY-274: TV error text is sanitized");
