"use strict";
// CAL-25: read-only fail-closed inspection. Never clear locks or replace trust anchors.
const { lstatSync, readFileSync, readdirSync } = require("node:fs");
const { resolve, dirname, basename } = require("node:path");
const HEX = /^[a-f0-9]{64}$/;
function inspectPin(pinPath) {
  const path = resolve(pinPath), findings = [];
  const flag = (code) => findings.push(code);
  let pin = null;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) flag("unsafe_pin_type");
    else {
      try {
        const value = JSON.parse(readFileSync(path, "utf8"));
        if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "head,sequence" ||
            !Number.isSafeInteger(value.sequence) || value.sequence < 0 ||
            typeof value.head !== "string" || !HEX.test(value.head)) flag("invalid_pin");
        else pin = value;
      } catch (_) { flag("invalid_pin"); }
    }
  } catch (e) {
    if (e.code === "ENOENT") flag("missing_pin");
    else flag("pin_unreadable");
  }
  try {
    const stat = lstatSync(path + ".lock");
    if (stat) flag("manual_lock_review_required");
  } catch (e) { if (e.code !== "ENOENT") flag("lock_unreadable"); }
  try {
    for (const name of readdirSync(dirname(path))) {
      if (name.startsWith(basename(path) + ".next-")) {
        flag("orphaned_temp_review_required"); break;
      }
    }
  } catch (_) { flag("directory_unreadable"); }
  return { status: findings.length ? "manual_review_required" : "consistent",
    findings, pin };
}
module.exports = { inspectPin };
if (require.main === module) {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) { console.error("cal25_usage: RECEIVER_PIN"); process.exitCode = 1; }
  else {
    const report = inspectPin(path);
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "consistent") process.exitCode = 1;
  }
}
