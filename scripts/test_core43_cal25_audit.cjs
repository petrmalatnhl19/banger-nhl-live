"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, symlinkSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { inspectPin } = require("./core43_cal25_audit.cjs");
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal25-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, "pin.json");
}
const valid = JSON.stringify({ sequence: 1, head: "a".repeat(64) });
test("CAL-25 reports consistent receiver pin without modifying it", t => {
  const path = setup(t); writeFileSync(path, valid);
  assert.equal(inspectPin(path).status, "consistent");
  assert.equal(readFileSync(path, "utf8"), valid);
});
test("CAL-25 fails closed on missing and malformed pins", t => {
  const path = setup(t);
  assert.deepEqual(inspectPin(path).findings, ["missing_pin"]);
  for (const value of ["{", "{}", '{"sequence":-1,"head":"a"}', '{"sequence":1,"head":"a"}']) {
    writeFileSync(path, value);
    assert.ok(inspectPin(path).findings.includes("invalid_pin"));
  }
});
test("CAL-25 identifies abandoned locks and orphaned temporary writes", t => {
  const path = setup(t); writeFileSync(path, valid);
  mkdirSync(path + ".lock"); writeFileSync(path + ".next-9999", "partial");
  const report = inspectPin(path);
  assert.ok(report.findings.includes("manual_lock_review_required"));
  assert.ok(report.findings.includes("orphaned_temp_review_required"));
  assert.equal(readFileSync(path, "utf8"), valid);
});
test("CAL-25 rejects symlinked pin and does not follow it", t => {
  const path = setup(t), target = path + ".trusted";
  writeFileSync(target, valid); symlinkSync(target, path);
  assert.ok(inspectPin(path).findings.includes("unsafe_pin_type"));
  assert.equal(readFileSync(target, "utf8"), valid);
});
