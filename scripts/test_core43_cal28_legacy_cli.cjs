"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
test("CAL-28D legacy CLI refuses bypass even with five arguments", () => {
  const script = resolve(__dirname, "core43_cal24_pin.cjs");
  const run = spawnSync(process.execPath, [script, "pin.json", "transfer.json", "key.pem", "witness", "a".repeat(64)], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /cal28d_legacy_cli_disabled_use_cal28_approved/);
});
