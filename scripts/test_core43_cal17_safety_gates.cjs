"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const read = path => readFileSync(join(root, path), "utf8");
const workflow = read(".github/workflows/core43-cal04-scheduled-dryrun.yml");
const timestamp = read("scripts/core43_cal16_timestamp.cjs");
const gates = read("docs/core43-cal17-pilot-security-gates.md");

test("production dry-run remains explicitly disabled", () => {
  assert.match(workflow, /dry-run:\s*\n[\s\S]*?if:\s*>-\s*\n\s*false\s*&&/);
});
test("PR jobs never receive production Supabase credentials", () => {
  const prJobs = workflow.split(/\n  dry-run:\s*\n/)[0];
  assert.doesNotMatch(prJobs, /secrets\./);
  assert.doesNotMatch(prJobs, /SUPABASE_SERVICE_ROLE_KEY/);
});
test("production read-only job has no service role", () => {
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY|secrets\.SERVICE_ROLE/);
  assert.match(workflow, /SUPABASE_READONLY_TOKEN/);
});
test("timestamp acceptance requires independent origin and verified start", () => {
  assert.match(timestamp, /trust\?\.origin === "historical" && options\?\.authority\?\.kind === "independent"/);
  assert.match(timestamp, /options\.outcome\?\.officialStart/);
  assert.match(timestamp, /latestMs < Date\.parse\(actual\.kickoff\) && latestMs < Date\.parse\(actual\.startedAt\)/);
  assert.match(timestamp, /"late_timestamp"/);
});
test("pilot gate document blocks activation without external evidence", () => {
  for (const term of ["nezávislé časové", "service_role", "dva fyzicky", "STOP", "žádný živý sběr"]) {
    assert.ok(gates.toLowerCase().includes(term.toLowerCase()), term);
  }
});
