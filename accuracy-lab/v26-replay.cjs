"use strict";

const { readFileSync } = require("node:fs");
const { models, timestamp, unique } = require("./engine.js");
const { sha256 } = require("./reference.cjs");
const { writeArchive } = require("./snapshot.cjs");

const source = Object.freeze({ slug: "nhl-prediction-collect", version: 26,
  bundleSha256: "aad6123716126e4ab7f7934daec6aa4fd9dae446cd08038ac2d5174d3c2bd42b" });
const modelIds = ["core40", "core41"];
const components = { xg4: 0.40, goalie32: 0.25, special33: 0.20, form31: 0.15 };
const componentIds = Object.keys(components);
const within = (at, bound) => Number.isFinite(timestamp(at)) && timestamp(at) <= bound;
const schema = "banger-core-v26-input-v1";
const numeric = value => typeof value === "number" && Number.isFinite(value)
  || typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value));

function weighted(inputs) {
  if (inputs.length < 2 || !inputs.some(row => row.key === "xg4")) return null;
  const total = inputs.reduce((sum, row) => sum + row.weight, 0);
  const forecast = side => Math.max(0.4, Math.min(6,
    inputs.reduce((sum, row) => sum + row.weight * Number(row[side]), 0) / total));
  return { away: forecast("a"), home: forecast("h"), inputs: inputs.map(row => ({
    model: row.key, weight_normalized: row.weight / total, predicted_at: row.at, away: row.a, home: row.h
  })) };
}

function valid(row, kickoff) {
  // Matches the v26 archive predicate. The wrapper validates a stricter T−60 envelope beforehand.
  return row.a !== null && row.h !== null && Number.isFinite(Number(row.a)) && Number.isFinite(Number(row.h))
    && Number(row.a) >= 0.4 && Number(row.h) >= 0.4 && row.at
    && Number.isFinite(Date.parse(row.at)) && Date.parse(row.at) < kickoff;
}

function kernel(input, model) {
  const goalie = input.goalie32Factors?.payload;
  const goalieQuality = goalie?.goalie_data_missing === false && Number(goalie?.away_goalie?.shots) >= 30
    && Number(goalie?.home_goalie?.shots) >= 30;
  const candidates = componentIds.map(key => {
    const row = input.components[key];
    return { key, weight: components[key], a: row.away, h: row.home, at: row.predictedAt,
      quality: model !== "core41" || key !== "goalie32" || goalieQuality };
  });
  const selected = candidates.filter(row => row.quality && valid(row, timestamp(input.scheduledAt)));
  const values = weighted(selected);
  if (!values) return { model, version: models[model].version, status: "no_prediction", reason: "v26_component_gate" };
  const gate = model === "core40"
    ? { missing: componentIds.filter(key => !selected.some(row => row.key === key)) }
    : { excluded: candidates.filter(row => !selected.includes(row)).map(row => ({
      model: row.key, reason: !row.quality ? "insufficient_goalie_evidence" : "missing_or_invalid_pregame_snapshot"
    })) };
  return { model, version: models[model].version, status: "calculated", ...values, ...gate };
}

function validDatum(row, cutoff, isComponent) {
  if (!row || !within(row.availableAt, cutoff) || typeof row.source !== "string"
    || !/^(https:\/\/\S+|urn:\S+)$/.test(row.source)) return false;
  if (!isComponent) return Object.hasOwn(row, "payload")
    && (row.payload === null || typeof row.payload === "object" && !Array.isArray(row.payload));
  if (!["away", "home", "predictedAt"].every(key => Object.hasOwn(row, key))) return false;
  const known = value => value === null || numeric(value);
  return known(row.away) && known(row.home) && (row.predictedAt === null
    ? row.away === null && row.home === null : within(row.predictedAt, timestamp(row.availableAt)));
}

function replay(input) {
  if (input?.schema !== schema || !["exact", "simulation"].includes(input.mode)
    || typeof input.gameId !== "string" || !/^\d{10}$/.test(input.gameId)
    || !Number.isSafeInteger(timestamp(input.scheduledAt))
    || timestamp(input.referenceAt) !== timestamp(input.scheduledAt) - 60 * 60_000) throw Error("Invalid v26 input envelope");
  const cutoff = timestamp(input.referenceAt);
  const missingComponents = componentIds.filter(key => !validDatum(input.components?.[key], cutoff, true));
  const goaliePresent = validDatum(input.goalie32Factors, cutoff, false);
  const missing = goaliePresent ? missingComponents : [...missingComponents, "goalie32Factors"];
  return { gameId: input.gameId, source, mode: input.mode === "exact" ? "exact_ensemble" : "simulation",
    snapshotSha256: sha256(input), missing, independentlyVerified: false, eligibleForPairing: false,
    models: missingComponents.length ? [] : modelIds.map(model => model === "core41" && !goaliePresent
      ? { model, version: models[model].version, status: "unavailable", reason: "missing_goalie32_factors" }
      : kernel(input, model)) };
}

function compareArchive(raw) {
  if (!Array.isArray(raw?.archive) || !Array.isArray(raw?.scope?.selectedIds)) throw Error("Invalid archived collector report");
  const ids = new Set(raw.scope.selectedIds.map(String));
  const issues = [];
  const items = unique(raw.archive, row => /^\d{10}$/.test(String(row?.game_id)) && String(row.game_id), "replay_archive", issues);
  const rows = [];
  for (const [gameId, row] of items) {
    if (!ids.has(gameId)) continue;
    for (const model of modelIds) {
      const a = row[model + "_away"], h = row[model + "_home"];
      if (a == null && h == null) continue;
      const factors = row[model + "_factors"];
      const archivedAt = timestamp(row[model + "_predicted_at"]);
      const kickoff = timestamp(factors?.game_start_utc);
      const knownMethod = model === "core40" ? "weighted_available_pregame_snapshots" : "quality_gated_pregame_ensemble";
      const inputs = Array.isArray(factors?.inputs) ? factors.inputs : [];
      const keys = new Set(inputs.map(item => item?.model));
      const eligible = row[model + "_version"] === models[model].version && [a, h, archivedAt, kickoff].every(Number.isFinite)
        && archivedAt < kickoff && factors?.source === "frozen_archive_only" && factors?.method === knownMethod
        && keys.size === inputs.length && inputs.every(item => Object.hasOwn(components, item?.model)
          && [item.away, item.home].every(numeric) && within(item.predicted_at, archivedAt));
      const fromArchive = componentIds.filter(key => keys.has(key)).map(key => {
        const item = inputs.find(entry => entry?.model === key);
        return { key, weight: components[key], a: item.away, h: item.home, at: item.predicted_at };
      });
      const values = eligible && fromArchive.every(item => valid(item, kickoff)) ? weighted(fromArchive) : null;
      if (!values || !values.inputs.every(item => Math.abs(item.weight_normalized
        - inputs.find(old => old.model === item.model).weight_normalized) < 1e-9)) {
        rows.push({ gameId, model, status: "unavailable", reason: "incomplete_or_invalid_archived_components" });
        continue;
      }
      const delta = { away: values.away - a, home: values.home - h };
      rows.push({ gameId, model, status: Math.max(Math.abs(delta.away), Math.abs(delta.home)) < 1e-9 ? "matched" : "different",
        expected: { away: a, home: h }, recalculated: { away: values.away, home: values.home }, delta });
    }
  }
  return { mode: "archived_intermediates", source, rows, issues, independentlyVerified: false, eligibleForPairing: false };
}

function report(result) {
  return { schema: "banger-core-v26-replay-report-v1", complete: 0, comparablePredictions: 0,
    independentlyVerified: false, result };
}

if (require.main === module) {
  try {
    const [command, input, output] = process.argv.slice(2);
    if (!output || !["replay", "archive-check"].includes(command)) throw Error("Usage: v26-replay.cjs replay|archive-check INPUT OUTPUT");
    const data = JSON.parse(readFileSync(input, "utf8"));
    writeArchive(report(command === "replay" ? replay(data) : compareArchive(data)), output);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { replay, compareArchive, report };
