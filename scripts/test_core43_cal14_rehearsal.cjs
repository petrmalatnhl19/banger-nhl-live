"use strict";

const assert = require("node:assert/strict");
const { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { prepare, load, rehearse } = require("./core43_cal14_rehearsal.cjs");

test("exchange contains only the synthetic envelope and public trust, with two independent pins", t => {
  const scratch = mkdtempSync(join(tmpdir(), "cal14-test-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const exchange = join(scratch, "exchange");
  const { digest, rootFingerprint } = prepare(exchange);
  assert.deepEqual(readdirSync(exchange).sort(), ["bundle.json", "registry.json", "root-public.pem"]);
  const pack = load(exchange, digest, rootFingerprint);
  assert.equal(JSON.parse(pack.blob).capture.prediction.origin, "simulation");
  assert.match(readFileSync(join(exchange, "root-public.pem"), "utf8"), /BEGIN PUBLIC KEY/);
  assert.throws(() => prepare(exchange), { code: "EEXIST" });
  assert.throws(() => load(exchange, digest, "0".repeat(64)), /cal14_root_pin/);
  writeFileSync(join(exchange, "bundle.json"), Buffer.concat([pack.blob, Buffer.from(" ")]));
  assert.throws(() => load(exchange, digest, rootFingerprint), /cal14_object_pin/);
});

test("read-only transport rejects writes and a retry survives a lost commit reply and restart", async t => {
  const scratch = mkdtempSync(join(tmpdir(), "cal14-test-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const exchange = join(scratch, "exchange");
  const { digest, rootFingerprint } = prepare(exchange);
  assert.deepEqual(await rehearse(load(exchange, digest, rootFingerprint)), {
    digest, origin: "simulation", afterRestart: "duplicate", verifiedVariants: 4,
  });
});
