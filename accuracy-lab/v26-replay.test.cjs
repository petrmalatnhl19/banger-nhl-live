"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { models } = require("./engine.js");
const { sha256, policy, inspectSnapshot } = require("./reference.cjs");
const { replay, compareArchive } = require("./v26-replay.cjs");
const { prepareExport, verifyExport } = require("./external-time.cjs");

const gameId = "2026020327";
const scheduledAt = "2026-11-16T01:00:00Z";
const referenceAt = "2026-11-16T00:00:00Z";
const earlier = "2026-11-15T23:50:00Z";
const datum = { source: "urn:test:v26-fixture", availableAt: earlier };

function input() {
  const row = (away, home) => ({ ...datum, away, home, predictedAt: earlier });
  return { schema: "banger-core-v26-input-v1", mode: "exact", gameId, scheduledAt, referenceAt,
    components: { xg4: row("4", 4), goalie32: row(3, 3), special33: row(2, 2), form31: row(1, 1) },
    goalie32Factors: { ...datum, payload: { goalie_data_missing: false, away_goalie: { shots: "30" }, home_goalie: { shots: 29 } } } };
}

test("mirrors v26 ordered weighted blend and exact CORE 4.1 goalie gate", () => {
  const snapshot = input();
  const result = replay(snapshot);
  assert.equal(result.snapshotSha256, sha256(snapshot));
  assert.equal(result.mode, "exact_ensemble");
  assert.equal(result.eligibleForPairing, false);
  assert.deepEqual(result, replay(snapshot));
  const [a, b] = result.models;
  assert.equal(a.away, (.4 * 4 + .25 * 3 + .20 * 2 + .15) / (.4 + .25 + .20 + .15));
  assert.equal(b.away, (.4 * 4 + .20 * 2 + .15) / (.4 + .20 + .15));
  assert.deepEqual(b.excluded, [{ model: "goalie32", reason: "insufficient_goalie_evidence" }]);
  snapshot.goalie32Factors.payload.home_goalie.shots = 30;
  assert.equal(replay(snapshot).models[1].away, a.away);
  snapshot.goalie32Factors.payload.goalie_data_missing = 0;
  assert.equal(replay(snapshot).models[1].away, b.away);
});

test("implements explicit component absence, mandatory xG4, lower eligibility bounds and upper clamp", () => {
  const snapshot = input();
  snapshot.components.xg4.away = 20;
  snapshot.components.special33.away = 20;
  snapshot.components.goalie32.away = 0.3999;
  snapshot.components.form31 = { ...datum, away: null, home: null, predictedAt: null };
  const result = replay(snapshot);
  assert.ok(result.models.every(row => row.status === "calculated" && row.away === 6));
  assert.deepEqual(result.models[0].missing, ["goalie32", "form31"]);
  snapshot.components.xg4 = { ...datum, away: null, home: null, predictedAt: null };
  assert.ok(replay(snapshot).models.every(row => row.status === "no_prediction"));
});

test("keeps unknown and later inputs missing and labels simulation separately", () => {
  const snapshot = input();
  delete snapshot.goalie32Factors;
  assert.deepEqual(replay(snapshot).missing, ["goalie32Factors"]);
  assert.deepEqual(replay(snapshot).models.map(row => row.status), ["calculated", "unavailable"]);
  snapshot.mode = "simulation";
  assert.equal(replay(snapshot).mode, "simulation");
  snapshot.components.xg4.availableAt = "2026-11-16T00:00:00.000001Z";
  assert.deepEqual(replay(snapshot).missing, ["xg4", "goalie32Factors"]);
  assert.deepEqual(replay(snapshot).models, []);
  snapshot.referenceAt = "2026-11-16T00:01:00Z";
  assert.throws(() => replay(snapshot), /Invalid v26 input/);
});

test("separates archived arithmetic, exposes differences and refuses missing component evidence", () => {
  const r = replay(input()).models[0];
  const row = { game_id: Number(gameId), core40_away: r.away, core40_home: r.home, core40_predicted_at: referenceAt,
    core40_version: models.core40.version, core40_factors: { source: "frozen_archive_only", game_start_utc: scheduledAt,
      method: "weighted_available_pregame_snapshots", inputs: r.inputs } };
  const raw = { scope: { selectedIds: [gameId] }, archive: [row, structuredClone(row)] };
  const check = () => compareArchive(raw);
  assert.equal(check().mode, "archived_intermediates");
  assert.equal(check().rows.length, 1);
  assert.equal(check().rows[0].status, "matched");
  assert.equal(check().eligibleForPairing, false);
  raw.archive.pop();
  row.core40_home += 0.25;
  assert.equal(check().rows[0].delta.home, -0.25);
  assert.equal(check().rows[0].status, "different");
  row.core40_factors.inputs[0].predicted_at = scheduledAt;
  assert.equal(check().rows[0].status, "unavailable");
  row.core40_factors.inputs.push(null);
  assert.equal(check().rows[0].status, "unavailable");
});

function manifest() {
  const payload = { gameId, away: "FLA", home: "DAL", scheduledAt };
  return { schema: policy.id, gameId, away: "FLA", home: "DAL", scheduledAt, referenceAt,
    observations: { schedule: { source: datum.source, dataThrough: earlier, availableAt: earlier, retrievedAt: earlier,
      payload, sha256: sha256(payload) } } };
}

test("exports signed exact bytes and a matching RFC3161 query without an external receipt", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const key = privateKey.export({ type: "pkcs8", format: "pem" });
  const create = () => prepareExport(manifest(), key, Date.parse(earlier));
  const submission = create();
  const audit = verifyExport(submission);
  assert.equal(audit.timeStatus, "unverified");
  assert.equal(audit.independentlyVerified, false);
  assert.equal(audit.eligibleForPairing, false);
  assert.ok(audit.missing.includes("lineups"));
  assert.equal(inspectSnapshot({ manifest: submission.envelope.manifest, receipt: submission.envelope }).status, "rejected");
  assert.throws(() => verifyExport({ ...submission, independentlyVerified: true }), /Invalid external/);
  assert.throws(() => verifyExport({ ...submission, request: create().request }), /does not match/);
  assert.throws(() => prepareExport(manifest(), key, Date.parse(scheduledAt)), /after_reference/);
  submission.envelope.signature = Buffer.alloc(64).toString("base64");
  assert.throws(() => verifyExport(submission), /Invalid local snapshot signature/);
});
