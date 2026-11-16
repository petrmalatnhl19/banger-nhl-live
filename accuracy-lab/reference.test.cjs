"use strict";

const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { canonical, models, summarizeReference } = require("./engine.js");
const { buildReference, inspectSnapshot, sha256 } = require("./reference.cjs");
const { freeze } = require("./snapshot.cjs");

const observer = generateKeyPairSync("ed25519");
const forecaster = generateKeyPairSync("ed25519");
const toPem = key => key.export({ format: "pem", type: "spki" });
const trust = { snapshot: { observer: toPem(observer.publicKey) },
  forecast: { forecaster: toPem(forecaster.publicKey) } };
const start = "2026-11-16T01:00:00Z";
const ref = "2026-11-16T00:00:00Z";
const earlier = "2026-11-15T23:45:00Z";
const after = "2026-11-16T00:15:00Z";

function receipt(purpose, value, observedAt) {
  const keyId = purpose === "snapshot" ? "observer" : "forecaster";
  const key = purpose === "snapshot" ? observer.privateKey : forecaster.privateKey;
  const statement = { schema: "banger-accuracy-receipt-v1", purpose, keyId, observedAt, sha256: sha256(value) };
  return { statement, signature: sign(null, Buffer.from(canonical(statement)), key).toString("base64") };
}

function fixture(scheduledAt = start) {
  const date = new Date(scheduledAt);
  const when = delta => new Date(+date + delta * 60_000).toISOString();
  const game = { id: "2026020327", date: scheduledAt.slice(0, 10), scheduledAt, actualStartAt: when(10),
    away: "FLA", home: "DAL", final: { away: 1, home: 2 }, playedGoals: { away: 1, home: 2 },
    regulation: { away: 1, home: 1 }, ending: "OT" };
  const data = {
    schedule: { gameId: game.id, away: game.away, home: game.home, scheduledAt },
    teamStats: { away: { goalsForPerGame: 2.8 }, home: { goalsForPerGame: 3.4 } },
    lineups: { away: [10, 11], home: [20, 21] },
    goalies: { away: { playerId: 12, status: "projected" }, home: { playerId: 22, status: "confirmed" } },
    homeAdvantage: { homeAdjustment: 0.1, awayAdjustment: 0 },
    rest: { away: { restHours: 24, backToBack: true }, home: { restHours: 48, backToBack: false } },
    absences: { away: [], home: [29] },
    baseline41: { goals: { away: 1.8, home: 2.6 }, version: models.core41.version },
    goalieGsax: { away: { playerId: 12, gsaxPer100Shots: -3, shotsAgainst: 100 },
      home: { playerId: 22, gsaxPer100Shots: 4, shotsAgainst: 120 } }
  };
  const manifest = { schema: "banger-core-accuracy-02-v1", gameId: game.id, away: game.away, home: game.home,
    scheduledAt, referenceAt: when(-60), observations: Object.fromEntries(Object.entries(data).map(([name, payload]) => [
      name, { source: "urn:test:fixture:" + name, dataThrough: when(-80), availableAt: when(-77), retrievedAt: when(-75),
        payload, sha256: sha256(payload) }
    ])) };
  const wrap = (observedAt = manifest.referenceAt) => ({ manifest, receipt: receipt("snapshot", manifest, observedAt) });
  const prediction = (model, options = {}) => {
    const forecast = { gameId: game.id, model, version: models[model].version, referenceAt: manifest.referenceAt,
      snapshotSha256: sha256(manifest), computedAt: when(-54), goals: { away: 2, home: 3 },
      goalTarget: "playedGoals", ...options };
    return { forecast, receipt: receipt("forecast", forecast, when(-50)) };
  };
  return { game, manifest, wrap, prediction };
}

function report(f, forecasts, now, snapshots = [f.wrap()]) {
  const games = [f.game];
  return { games, reference: buildReference(games, { snapshots, forecasts }, trust, now) };
}

test("requires exact T−60, trusted signing key and intact manifest", () => {
  const f = fixture();
  const envelope = f.wrap();
  assert.equal(inspectSnapshot(envelope, trust.snapshot).status, "verified");
  assert.equal(inspectSnapshot(envelope).reason, "untrusted_snapshot_receipt");
  f.manifest.observations.rest.payload.away.restHours = 25;
  assert.equal(inspectSnapshot(envelope, trust.snapshot).reason, "untrusted_snapshot_receipt");
  assert.equal(inspectSnapshot(f.wrap(), trust.snapshot).reason, "invalid_observation");
  f.manifest.referenceAt = earlier;
  assert.equal(inspectSnapshot(f.wrap(), trust.snapshot).reason, "wrong_reference_time");
});

test("rejects a future retrieval or publication and submillisecond-late snapshot receipt", () => {
  const f = fixture();
  const item = f.manifest.observations.goalies;
  item.retrievedAt = after;
  assert.equal(inspectSnapshot(f.wrap(), trust.snapshot).reason, "invalid_observation_time");
  item.retrievedAt = earlier;
  item.availableAt = after;
  assert.equal(inspectSnapshot(f.wrap(), trust.snapshot).input, "goalies");
  item.availableAt = earlier;
  item.dataThrough = after;
  assert.equal(inspectSnapshot(f.wrap(), trust.snapshot).reason, "invalid_observation_time");
  item.dataThrough = earlier;
  assert.equal(inspectSnapshot(f.wrap("2026-11-16T00:00:00.000001Z"), trust.snapshot).reason, "snapshot_after_reference");
});

test("identifies incomplete snapshots and rejects unrecognized result fields and identity mismatches", () => {
  const f = fixture();
  delete f.manifest.observations.absences;
  assert.deepEqual(inspectSnapshot(f.wrap(), trust.snapshot).missing, ["absences"]);
  assert.equal(report(f, [f.prediction("core40")]).reference.records.length, 0);
  const row = f.manifest.observations.teamStats;
  row.payload.home.finalScore = 2;
  row.sha256 = sha256(row.payload);
  assert.equal(inspectSnapshot(f.wrap(), trust.snapshot).reason, "invalid_observation");
  delete row.payload.home.finalScore;
  row.sha256 = sha256(row.payload);
  f.game.home = "EDM";
  assert.equal(report(f, []).reference.coverage[0].reason, "official_schedule_or_start_mismatch");
});

test("requires official start after T−60 and rejects rescheduled games", () => {
  const f = fixture();
  f.game.actualStartAt = ref;
  assert.equal(report(f, []).reference.coverage[0].status, "rejected");
  f.game.actualStartAt = "2026-11-16T01:10:00Z";
  f.game.scheduledAt = "2026-11-16T01:05:00Z";
  assert.equal(report(f, []).reference.coverage[0].reason, "official_schedule_or_start_mismatch");
});

test("requires attested model version, snapshot digest, cutoff and pregame receipt ordering", () => {
  const f = fixture();
  for (const changes of [{ version: "unregistered" }, { snapshotSha256: "0".repeat(64) },
    { referenceAt: earlier }, { computedAt: earlier }, { computedAt: after }]) {
    const result = report(f, [f.prediction("core40", changes)]).reference;
    assert.equal(result.issues.length, 1);
    assert.ok(result.records.every(row => row.kind === "simulation"));
  }
  const late = f.prediction("core40");
  late.receipt = receipt("forecast", late.forecast, start);
  assert.equal(report(f, [late]).reference.issues[0].reason, "forecast_time_or_receipt_invalid");
  const shadow = f.prediction("core43");
  assert.ok(report(f, [shadow]).reference.records.every(row => row.kind === "simulation"));
});

test("pairs matching signed archives, keeps simulations separate, and counts unique predictions", () => {
  const f = fixture();
  const a = f.prediction("core40");
  const b = f.prediction("core41");
  const c = f.prediction("core42");
  const data = report(f, [a, b, c]);
  const paired = summarizeReference(data);
  assert.equal(paired.comparableGames, 1);
  assert.equal(paired.comparablePredictions, 3);
  assert.equal(paired.paired.length, 3);
  assert.deepEqual(paired.paired[0].sameSnapshot.mae, [1, 1]);
  const simulation = summarizeReference(data, { kind: "simulation" });
  assert.equal(simulation.comparablePredictions, 0);
  assert.equal(simulation.records[0].model, "core43");
  assert.equal(summarizeReference(data, { kind: "reproduced" }).records.length, 0);
  assert.equal(summarizeReference(report(f, [a, f.prediction("core41", { goalTarget: "regulation" })]))
    .comparablePredictions, 0);
});

test("rejects competing snapshots or forecast revisions while collapsing identical duplicates", () => {
  const f = fixture();
  const first = f.wrap();
  const other = structuredClone(first);
  other.manifest.observations.teamStats.payload.home.goalsForPerGame = 4;
  const a = f.prediction("core40");
  const b = f.prediction("core41");
  assert.equal(summarizeReference(report(f, [a, b], undefined, [first, first])).comparablePredictions, 2);
  assert.equal(summarizeReference(report(f, [a, b], undefined, [first, other])).coverage[0].reason, "conflicting_snapshot");
  assert.equal(summarizeReference(report(f, [a, b, f.prediction("core41", { goals: { home: 9, away: 2 } })]))
    .comparablePredictions, 0);
});

test("isolates and embargoes the entire preregistered validation period", () => {
  const f = fixture("2026-12-01T00:00:00Z");
  const predictions = [f.prediction("core40"), f.prediction("core41")];
  const open = report(f, predictions, Date.parse("2026-12-31T23:59:59Z"));
  assert.equal(open.reference.records.length, 0);
  assert.equal(open.reference.ablations.length, 0);
  assert.equal(open.reference.coverage[0].embargoed, true);
  const closed = report(f, predictions, Date.parse("2027-01-01T00:00:00Z"));
  assert.equal(summarizeReference(closed).comparablePredictions, 0);
  assert.equal(summarizeReference(closed, { partition: "validation" }).comparablePredictions, 2);
  const outside = fixture("2027-01-01T00:00:00Z");
  const after = report(outside, [outside.prediction("core40")], Date.parse("2027-01-02T00:00:00Z"));
  assert.equal(after.reference.coverage[0].partition, "outside");
  assert.equal(after.reference.records.length, 0);
});

test("changes only the goalie GSAx coefficient and requires matching player IDs", () => {
  const f = fixture();
  const comparison = report(f, []).reference.ablations[0];
  assert.deepEqual(comparison.values, [0.02, 0]);
  assert.deepEqual(comparison.full, { away: 1.72, home: 2.66 });
  assert.deepEqual(comparison.neutral, { away: 1.8, home: 2.6 });
  const row = f.manifest.observations.goalieGsax;
  row.payload.away.playerId = 999;
  row.sha256 = sha256(row.payload);
  assert.equal(report(f, []).reference.ablations.length, 0);
});

test("freezes signed canonical payload locally and refuses to overwrite it", t => {
  const f = fixture();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "accuracy-snapshot-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const file = path.join(dir, "snapshot.json");
  const envelope = f.wrap();
  assert.equal(freeze(envelope, trust, file).status, "verified");
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), envelope);
  assert.throws(() => freeze(envelope, trust, file), { code: "EEXIST" });
  assert.throws(() => freeze(envelope, { snapshot: {} }, path.join(dir, "bad.json")), /untrusted_snapshot_receipt/);
});

test("identical frozen inputs reproduce the simulation byte for byte without outcome data", () => {
  const f = fixture();
  const first = report(f, []).reference;
  f.game.final = { away: 2, home: 1 };
  f.game.playedGoals = { away: 2, home: 1 };
  const second = report(f, []).reference;
  assert.equal(canonical(first.records), canonical(second.records));
  assert.equal(canonical(first.ablations), canonical(second.ablations));
});
