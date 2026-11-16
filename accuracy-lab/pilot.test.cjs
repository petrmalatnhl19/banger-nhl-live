"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync } = require("node:crypto");
const { sha256 } = require("./reference.cjs");
const { collectPilot, analyze, seal, dashboard, verifyArchive } = require("./pilot.cjs");
const { verifyExport } = require("./external-time.cjs");

const { fixture, id, date, cutoff, open, at } = require("./pilot-test-fixture.cjs");
const { privateKey } = generateKeyPairSync("ed25519");
const pem = privateKey.export({ type: "pkcs8", format: "pem" });

function rewrite(record, callback) {
  const value = JSON.parse(Buffer.from(record.bytes, "base64").toString());
  callback(value);
  const bytes = Buffer.from(JSON.stringify(value));
  record.bytes = bytes.toString("base64");
  record.sha256 = createHash("sha256").update(bytes).digest("hex");
  record.version = "sha256:" + record.sha256;
}

test("manual window opens at T−75 and closes for new collection at T−60", async () => {
  await assert.rejects(() => collectPilot(date, id, "capture", fixture(() => open - 1)), /Capture opens/);
  await assert.rejects(() => collectPilot(date, id, "capture", fixture(() => cutoff)), /before T−60/);
  const beginning = await collectPilot(date, id, "capture", fixture(() => open));
  assert.equal(analyze(beginning).reason, null);
  assert.doesNotThrow(() => seal(beginning, pem, () => cutoff));
  assert.throws(() => seal(beginning, pem, () => cutoff + 1), /inside the T−60/);
  let checks = 0;
  assert.throws(() => seal(beginning, pem, () => checks++ === 0 ? cutoff : cutoff + 1), /Signing finished after T−60/);
});

test("one captured input yields deterministic v26 results with signed archive binding and unverified time", async () => {
  const options = fixture();
  const capture = await collectPilot(date, id, "capture", options);
  assert.deepEqual(options.archiveHeaders, [true, true]);
  assert.equal(JSON.stringify(capture).includes("sb_publishable_"), false);
  const view = analyze(capture);
  assert.deepEqual(view.missing, []);
  const frozen = seal(capture, pem, () => at);
  assert.equal(frozen.pair.snapshotSha256, sha256(frozen.input));
  assert.deepEqual(frozen.pair, seal(capture, pem, () => at).pair);
  assert.deepEqual(frozen.pair.models.map(model => model.status), ["calculated", "calculated"]);
  assert.notEqual(frozen.pair.models[0].away, frozen.pair.models[1].away);
  assert.equal(frozen.pair.models[1].excluded[0].model, "goalie32");
  assert.equal(verifyExport(frozen.external).timeStatus, "unverified");
  assert.equal(verifyArchive(frozen).archivedAt, new Date(at).toISOString());
  assert.equal(dashboard(frozen).internallyCalculated.length, 2);
  assert.equal(dashboard(frozen).completeSnapshots, 0);
  assert.equal(dashboard(frozen).validPairs, 0);
  assert.deepEqual(dashboard(capture).internallyCalculated, []);
});

test("late source or late data drops the component, so no numbers are manufactured", async () => {
  const capture = await collectPilot(date, id, "capture", fixture());
  const late = structuredClone(capture);
  late.archive.components.retrievedAt = new Date(cutoff + 1).toISOString();
  assert.ok(analyze(late).missing.includes("xg4"));
  assert.equal(seal(late, pem, () => at).pair, null);
  rewrite(capture.archive.components, rows => { rows[0].xg4_predicted_at = new Date(cutoff + 1).toISOString(); });
  const result = seal(capture, pem, () => at);
  assert.deepEqual(result.missing, ["xg4"]);
  assert.equal(result.reason, "required_inputs_missing");
  assert.equal(result.pair, null);
});

test("a future diagnostic probe cannot be signed as a live snapshot", async () => {
  const capture = await collectPilot(date, id, "probe", fixture(() => open - 60000));
  assert.equal(dashboard(capture).status, "diagnostic");
  assert.equal(dashboard(capture).reason, "diagnostic_outside_window");
  assert.deepEqual(dashboard(capture).internallyCalculated, []);
  assert.throws(() => seal(capture, pem, () => at), /inside the T−60/);
});

test("rejects mismatched schedule and unknown or missing component versions", async () => {
  const capture = await collectPilot(date, id, "capture", fixture());
  const wrong = structuredClone(capture);
  rewrite(wrong.archive.archivedSchedule, rows => { rows[0].kickoff_at = "2026-11-18T04:00:00Z"; });
  assert.equal(analyze(wrong).reason, "archive_schedule_unlinked");
  assert.equal(seal(wrong, pem, () => at).pair, null);
  rewrite(capture.archive.components, rows => { rows[0].goalie32_version = "unknown"; });
  assert.deepEqual(analyze(capture).missing, ["goalie32", "goalie32Factors"]);
});

test("archive tampering with an input or a computed goal invalidates the verifiable export", async () => {
  const capture = await collectPilot(date, id, "capture", fixture());
  const frozen = seal(capture, pem, () => at);
  const before = structuredClone(frozen);
  before.capture.archive.components.sha256 = "f".repeat(64);
  assert.throws(() => verifyArchive(before), /does not match/);
  frozen.pair.models[0].home += 1;
  assert.throws(() => verifyArchive(frozen), /does not match/);
});
