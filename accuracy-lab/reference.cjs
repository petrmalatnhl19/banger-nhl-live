"use strict";

const { createHash, createPublicKey, verify } = require("node:crypto");
const { models, timestamp, kickoff, canonical, unique } = require("./engine.js");
const { calculateShadow } = require("../scripts/core43_gsax_sensitivity.cjs");

const policy = Object.freeze({
  id: "banger-core-accuracy-02-v1",
  leadMinutes: 60,
  validationStart: "2026-12-01T00:00:00Z",
  validationEndExclusive: "2027-01-01T00:00:00Z"
});
const required = ["schedule", "teamStats", "lineups", "goalies", "homeAdvantage", "rest", "absences"];
const statisticNames = ["gamesPlayed", "goalsForPerGame", "goalsAgainstPerGame",
  "xgFor60", "xgAgainst60", "powerPlayPct", "penaltyKillPct",
  "recentGoalsForPerGame", "recentGoalsAgainstPerGame"];
const optional = ["baseline41", "goalieGsax"];
const local = Object.freeze({
  core40: { replay: "exact_ensemble", reason: "missing_frozen_upstream_pipeline_inputs",
    version: models.core40.version, blocker: "Výpočet v26 je dostupný. Chybí společné zmrazené vstupy xG4, formy, speciálních týmů a brankářů." },
  core41: { replay: "exact_ensemble", reason: "missing_frozen_upstream_and_quality_inputs",
    version: models.core41.version, blocker: "Výpočet i brankářská brána v26 jsou dostupné. Chybí zmrazené vstupní vzorky a doklady." },
  core42: { replay: "unavailable", reason: "missing_versioned_late_goalie_pipeline",
    version: models.core42.version, blocker: "Chybí zdroj pozdního výpočtu a původní zmrazené podklady." },
  core43: { replay: "simulation_only", reason: "gsax_sensitivity_only",
    version: "core43_gsax_sensitivity_v0", blocker: "Simulace vyžaduje zmrazenou CORE 4.1 a GSAx obou brankářů." }
});

const object = value => value != null && typeof value === "object" && !Array.isArray(value);
const fields = (value, names) => object(value) && Object.keys(value).length === names.length
  && names.every(name => Object.hasOwn(value, name));
const sha256 = value => createHash("sha256").update(canonical(value)).digest("hex");
const team = value => typeof value === "string" && /^[A-Z]{3}$/.test(value);
const id = value => typeof value === "string" && /^\d{10}$/.test(value);
const finiteGoals = g => fields(g, ["away", "home"]) && [g.away, g.home].every(x => Number.isFinite(x) && x >= 0 && x <= 20);
const sideData = (value, predicate) => fields(value, ["away", "home"]) && ["away", "home"].every(side => predicate(value[side]));
const playerId = value => Number.isSafeInteger(value) && value > 0;
const referenceAt = scheduledAt => timestamp(scheduledAt) - policy.leadMinutes * 60_000;

function signedReceipt(receipt, purpose, digest, keys) {
  const statement = receipt?.statement;
  const expected = ["schema", "purpose", "keyId", "observedAt", "sha256"];
  if (!fields(receipt, ["statement", "signature"]) || !fields(statement, expected)
    || statement.schema !== "banger-accuracy-receipt-v1" || statement.purpose !== purpose
    || statement.sha256 !== digest || !Number.isFinite(timestamp(statement.observedAt))
    || typeof statement.keyId !== "string" || !Object.hasOwn(keys, statement.keyId)
    || typeof receipt.signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signature)) return NaN;
  try {
    const key = createPublicKey(keys[statement.keyId]);
    const signature = Buffer.from(receipt.signature, "base64");
    return key.asymmetricKeyType === "ed25519" && signature.toString("base64") === receipt.signature
      && verify(null, Buffer.from(canonical(statement)), key, signature)
      ? timestamp(statement.observedAt) : NaN;
  } catch {
    return NaN;
  }
}

function sameSchedule(a, b) {
  return a?.away === b.away && a?.home === b.home && timestamp(a.scheduledAt) === timestamp(b.scheduledAt);
}

function validPayload(name, payload, manifest) {
  switch (name) {
    case "schedule":
      return fields(payload, ["gameId", "scheduledAt", "away", "home"]) && payload.gameId === manifest.gameId
        && sameSchedule(payload, manifest);
    case "teamStats":
      return sideData(payload, value => object(value) && Object.keys(value).length > 0
        && Object.entries(value).every(([key, stat]) => statisticNames.includes(key)
          && Number.isFinite(stat) && stat >= 0));
    case "lineups":
      return sideData(payload, value => Array.isArray(value) && value.length > 0 && value.every(playerId));
    case "goalies":
      return sideData(payload, value => fields(value, ["playerId", "status"]) && playerId(value.playerId)
        && ["projected", "confirmed"].includes(value.status));
    case "homeAdvantage":
      return fields(payload, ["homeAdjustment", "awayAdjustment"])
        && [payload.homeAdjustment, payload.awayAdjustment].every(Number.isFinite);
    case "rest":
      return sideData(payload, value => fields(value, ["restHours", "backToBack"])
        && Number.isFinite(value.restHours) && value.restHours >= 0 && typeof value.backToBack === "boolean");
    case "absences":
      return sideData(payload, value => Array.isArray(value) && value.every(playerId));
    case "baseline41":
      return fields(payload, ["goals", "version"]) && payload.version === models.core41.version && finiteGoals(payload.goals);
    case "goalieGsax":
      return sideData(payload, value => fields(value, ["playerId", "gsaxPer100Shots", "shotsAgainst"])
        && playerId(value.playerId) && Number.isFinite(value.gsaxPer100Shots)
        && Number.isSafeInteger(value.shotsAgainst) && value.shotsAgainst >= 0);
    default:
      return false;
  }
}

function validProvenance(provenance, row) {
  const hex = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  const locator = value => typeof value === "string" && /^(https:\/\/[^\s]+|urn:[^\s]+)$/.test(value);
  if (!fields(provenance, ["captureSha256", "evidence", "method", "sources"])
    || !hex(provenance.captureSha256) || provenance.method !== "live_retrieval_witness"
    || !locator(provenance.evidence) || !Array.isArray(provenance.sources) || !provenance.sources.length
    || timestamp(row.availableAt) !== timestamp(row.retrievedAt)) return false;
  return provenance.sources.every(source => fields(source, ["url", "sha256", "version", "retrievedAt", "dataPublishedAt"])
    && typeof source.url === "string" && /^https:\/\/[^\s]+$/.test(source.url)
    && hex(source.sha256) && source.version === "sha256:" + source.sha256 && source.dataPublishedAt === null
    && Number.isFinite(timestamp(source.retrievedAt)))
    && Math.max(...provenance.sources.map(source => timestamp(source.retrievedAt))) === timestamp(row.retrievedAt);
}

function inspectManifest(manifest, seen) {
  const bad = reason => ({ status: "rejected", reason, missing: required.slice() });
  if (!fields(manifest, [
    "schema", "gameId", "away", "home", "scheduledAt", "referenceAt", "observations"
  ]) || manifest.schema !== policy.id || !id(manifest.gameId) || !team(manifest.away)
    || !team(manifest.home) || manifest.away === manifest.home || !object(manifest.observations)) {
    return bad("invalid_snapshot");
  }
  const ref = referenceAt(manifest.scheduledAt);
  if (!Number.isSafeInteger(ref) || timestamp(manifest.referenceAt) !== ref) return bad("wrong_reference_time");
  const digest = sha256(manifest);
  if (!Number.isFinite(seen)) return bad("untrusted_snapshot_receipt");
  if (seen > ref) return bad("snapshot_after_reference");
  const missing = required.filter(name => !Object.hasOwn(manifest.observations, name));
  for (const [name, row] of Object.entries(manifest.observations)) {
    const expected = ["source", "dataThrough", "availableAt", "retrievedAt", "sha256", "payload"];
    if (row && Object.hasOwn(row, "provenance")) expected.push("provenance");
    if (![...required, ...optional].includes(name) || !fields(row, expected) || typeof row.source !== "string" || !/^(https:\/\/[^\s]+|urn:[^\s]+)$/.test(row.source)
      || row.sha256 !== sha256(row.payload) || !validPayload(name, row.payload, manifest)
      || (Object.hasOwn(row, "provenance") && !validProvenance(row.provenance, row))) {
      return { status: "rejected", reason: "invalid_observation", input: name, missing };
    }
    const times = [row.dataThrough, row.availableAt, row.retrievedAt].map(timestamp);
    if (!times.every(Number.isFinite) || times[0] > times[1] || times[1] > times[2] || times[2] > seen) {
      return { status: "rejected", reason: "invalid_observation_time", input: name, missing };
    }
  }
  return { status: missing.length ? "incomplete" : "verified", digest, referenceAt: manifest.referenceAt, missing,
  };
}

function inspectSnapshot(bundle, keys = {}) {
  if (!fields(bundle, ["manifest", "receipt"])) return { status: "rejected", reason: "invalid_snapshot", missing: required.slice() };
  const seen = signedReceipt(bundle.receipt, "snapshot", sha256(bundle.manifest), keys);
  const result = inspectManifest(bundle.manifest, seen);
  return result.status === "rejected" ? result
    : { ...result, witness: bundle.receipt.statement.keyId, witnessedAt: bundle.receipt.statement.observedAt };
}

function inspectForecast(bundle, snapshot, verified, boundary, keys) {
  const row = bundle?.forecast;
  const manifest = snapshot.manifest;
  if (!fields(bundle, ["forecast", "receipt"]) || !fields(row, [
    "gameId", "model", "version", "referenceAt", "snapshotSha256", "computedAt", "goals", "goalTarget"
  ]) || row.gameId !== manifest.gameId || !Object.hasOwn(models, row.model) || !models[row.model].version
    || row.version !== models[row.model].version || row.snapshotSha256 !== verified.digest || !finiteGoals(row.goals)
    || !["playedGoals", "regulation"].includes(row.goalTarget)) return { reason: "forecast_snapshot_or_version_mismatch" };
  const ref = timestamp(manifest.referenceAt);
  const computed = timestamp(row.computedAt);
  const seen = signedReceipt(bundle.receipt, "forecast", sha256(row), keys);
  if (timestamp(row.referenceAt) !== ref || !Number.isFinite(computed) || !Number.isFinite(seen)
    || computed < ref || seen < computed || seen >= boundary) return { reason: "forecast_time_or_receipt_invalid" };
  return { record: { ...row, kind: "archived", asOf: manifest.referenceAt,
    evidence: "reference_witness", inputs: [], probability: null, witnessedAt: bundle.receipt.statement.observedAt } };
}

function experimentalGoalies(snapshot, verified) {
  const { observations, referenceAt: asOf, gameId } = snapshot.manifest;
  const baseline = observations.baseline41;
  const goalie = observations.goalies?.payload;
  const gsax = observations.goalieGsax;
  if (!baseline || !goalie || !gsax || !["away", "home"].every(side =>
    goalie[side].playerId === gsax.payload[side].playerId)) return undefined;
  const run = coefficient => calculateShadow({ asOf, coefficient,
    baseline: { ...baseline.payload.goals, predictedAt: baseline.availableAt },
    awayGoalie: { available: true, value: { ...gsax.payload.away, fetchedAt: gsax.retrievedAt } },
    homeGoalie: { available: true, value: { ...gsax.payload.home, fetchedAt: gsax.retrievedAt } }
  });
  const full = run(0.02);
  const neutral = run(0);
  if (!full.available || !neutral.available) return undefined;
  const goals = result => ({ away: result.expectedAwayGoals, home: result.expectedHomeGoals });
  return { record: { gameId, model: "core43", version: full.model, kind: "simulation", asOf,
    evidence: "reference_sensitivity", snapshotSha256: verified.digest, goalTarget: "playedGoals",
    goals: goals(full), probability: null, inputs: [] },
  ablation: { gameId, factor: "goalies", parameter: "GSAx coefficient", values: [0.02, 0],
    full: goals(full), neutral: goals(neutral) } };
}

function validationPartition(scheduledAt) {
  const at = timestamp(scheduledAt);
  if (at < timestamp(policy.validationStart)) return "pilot";
  return at < timestamp(policy.validationEndExclusive) ? "validation" : "outside";
}

function buildReference(games, bundle = {}, trust = {}, now = Date.now()) {
  if (!object(bundle) || !object(trust) || (bundle.snapshots != null && !Array.isArray(bundle.snapshots))
    || (bundle.forecasts != null && !Array.isArray(bundle.forecasts))
    || !object(trust.snapshot ?? {}) || !object(trust.forecast ?? {})) throw Error("Invalid reference bundle or trust");
  const issues = [];
  const inputSnapshots = bundle.snapshots ?? [];
  const snapshots = unique(inputSnapshots, row => id(row?.manifest?.gameId) && row.manifest.gameId, "reference_snapshot", issues);
  const allForecasts = unique(bundle.forecasts ?? [], row => id(row?.forecast?.gameId)
    && Object.hasOwn(models, row.forecast.model) && row.forecast.gameId + "/" + row.forecast.model, "reference_forecast", issues);
  const forecasts = new Map();
  for (const row of allForecasts.values()) {
    const key = row.forecast.gameId;
    if (!forecasts.has(key)) forecasts.set(key, []);
    forecasts.get(key).push(row);
  }
  const attempted = new Set(inputSnapshots.map(row => row?.manifest?.gameId));
  const records = [], coverage = [], ablations = [];
  const validationOpen = now < timestamp(policy.validationEndExclusive);
  for (const game of games) {
    const partition = validationPartition(game.scheduledAt);
    const snapshot = snapshots.get(game.id);
    const boundary = kickoff(game);
    const cutoff = new Date(referenceAt(game.scheduledAt)).toISOString();
    let entry = { gameId: game.id, partition, referenceAt: cutoff, missing: required.slice(),
      status: attempted.has(game.id) ? "rejected" : "missing",
      ...(attempted.has(game.id) && { reason: "conflicting_snapshot" }) };
    if (snapshot) {
      entry = { ...entry, ...inspectSnapshot(snapshot, trust.snapshot ?? {}) };
      if (entry.status !== "rejected" && (!sameSchedule(snapshot.manifest, game)
        || !Number.isFinite(boundary) || timestamp(cutoff) >= boundary)) {
        entry = { ...entry, status: "rejected", reason: "official_schedule_or_start_mismatch" };
      }
    }
    const hidden = partition === "validation" && validationOpen;
    const acquisition = ["verified", "incomplete"].includes(entry.status)
      ? Object.entries(snapshot.manifest.observations).map(([key, row]) => ({ key, retrievedAt: row.retrievedAt })) : [];
    coverage.push({ ...entry, acquisition, embargoed: hidden });
    if (entry.status !== "verified" || hidden || partition === "outside") continue;
    for (const row of forecasts.get(game.id) ?? []) {
      const result = inspectForecast(row, snapshot, entry, boundary, trust.forecast ?? {});
      if (result.record) records.push(result.record);
      else issues.push({ gameId: game.id, model: row.forecast.model, reason: result.reason });
    }
    const experiment = experimentalGoalies(snapshot, entry);
    if (experiment) {
      records.push(experiment.record);
      ablations.push({ ...experiment.ablation, partition });
    }
  }
  return { policy, required, models: local, validationOpen, coverage, records, ablations, issues };
}

function reviewReference(games, bundle, trust) {
  const report = buildReference(games, bundle, trust);
  // Imported v1 signatures remain readable as diagnostics. The new protocol has no external attestation yet.
  const coverage = report.coverage.map(row => row.status === "verified"
    ? { ...row, status: "legacy", reason: "external_player_evidence_required" } : row);
  return { ...report, coverage, records: report.records.filter(row => row.kind !== "archived") };
}

module.exports = { buildReference, reviewReference, inspectSnapshot, inspectManifest, sha256, policy, required, availability: local };
