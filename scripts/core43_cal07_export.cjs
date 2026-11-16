"use strict";

const { createHash, verify } = require("node:crypto");
const { TABLES } = require("./core43_live_shadow_source_reader.cjs");
const { adaptArchivedGsaxSnapshots } = require("./core43_archived_gsax_snapshot_adapter.cjs");
const { assemblePregameSourceInput } = require("./core43_pregame_source_assembly.cjs");
const { plan, WINDOW } = require("./core43_cal03_capture_plan.cjs");

const SCHEMA = "core43_cal07_pregame_export_v1";
const DOMAIN = Buffer.from(SCHEMA + "\0");
const signatureMessage = bytes => Buffer.concat([DOMAIN, bytes]);
const MAX_BYTES = 64 * 1024;
const MAX_AGE_MS = 5 * 60_000;
const TEAM = /^[A-Z]{3}$/;
const ID = /^[1-9][0-9]{0,15}$/;
const SHA = /^[a-f0-9]{64}$/;
const projections = Object.fromEntries(Object.entries(TABLES).map(([name, [, columns]]) => [name, columns.split(",")]));

function requireValid(condition, code) {
  if (!condition) throw Error("cal07_" + code);
}

function iso(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function exactFields(value, fields) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function minutesTo(kickoffAt, at) {
  return (Date.parse(kickoffAt) - Date.parse(at)) / 60_000;
}

function inWindow(minutes) {
  return minutes >= WINDOW.minMinutes && minutes <= WINDOW.maxMinutes;
}

function validateRows(tables, gameId, asOf) {
  const names = Object.keys(projections);
  requireValid(exactFields(tables, names), "tables");
  for (const name of names) {
    const rows = tables[name];
    requireValid(Array.isArray(rows) && rows.length <= 64, "row_count");
    requireValid(rows.every(row => exactFields(row, projections[name])), "columns");
    const keys = rows.map(row => JSON.stringify(projections[name].map(column => row[column])));
    requireValid(new Set(keys).size === rows.length, "duplicate_row");
  }

  const { schedules, predictions, observations, identities, goalieSnapshotRows } = tables;
  requireValid(schedules.length === 1 && predictions.length === 1, "game_records");
  const [schedule] = schedules;
  const [prediction] = predictions;
  const { away_team: awayTeam, home_team: homeTeam, kickoff_at: kickoffAt } = schedule;
  const eligibleTime = value => iso(value) && value <= asOf;
  const team = value => value === awayTeam || value === homeTeam;
  const id = value => typeof value === "string" && ID.test(value);
  const name = value => typeof value === "string" && value.trim() === value &&
    value.length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value);
  const nonnegative = value => Number.isFinite(value) && value >= 0;
  const score = value => nonnegative(value) && value <= 20;

  requireValid(typeof awayTeam === "string" && typeof homeTeam === "string" &&
    TEAM.test(awayTeam) && TEAM.test(homeTeam) && awayTeam !== homeTeam &&
    schedule.game_id === gameId && eligibleTime(schedule.fetched_at) && iso(kickoffAt) &&
    inWindow(minutesTo(kickoffAt, asOf)), "schedule");
  requireValid(prediction.game_id === gameId && prediction.away_team === awayTeam &&
    prediction.home_team === homeTeam && eligibleTime(prediction.core42_predicted_at) &&
    score(prediction.core42_away) && score(prediction.core42_home), "prediction");
  requireValid(observations.every(row => row.game_id === gameId && team(row.team_code) &&
    name(row.goalie_name) && ["projected", "confirmed"].includes(row.observed_status) &&
    eligibleTime(row.observed_at) && eligibleTime(row.source_snapshot_at) &&
    row.source_snapshot_at <= row.observed_at), "observation");
  requireValid(identities.every(row => team(row.team_code) && id(row.goalie_id) &&
    name(row.goalie_name) && eligibleTime(row.observed_at)), "identity");
  requireValid(goalieSnapshotRows.every(row => team(row.team_code) && id(row.goalie_id) &&
    row.situation === "all" && eligibleTime(row.fetched_at) && eligibleTime(row.created_at) &&
    row.fetched_at <= row.created_at && typeof row.source_sha256 === "string" && SHA.test(row.source_sha256) &&
    nonnegative(row.x_goals_against) && nonnegative(row.goals_against) && nonnegative(row.shots_against)), "goalie_snapshot");
  const snapshotIds = goalieSnapshotRows.map(row => row.fetched_at + ":" + row.source_sha256);
  const goalieKeys = goalieSnapshotRows.map(row => row.team_code + ":" + row.goalie_id);
  requireValid(new Set(snapshotIds).size <= 1 && new Set(goalieKeys).size === goalieKeys.length, "ambiguous_snapshot");
  return { awayTeam, homeTeam, kickoffAt };
}

// Pure consumer prototype. The public key and source binding come from trusted
// configuration; neither is taken from the bundle or resolved over the network.
function planSignedExport({ bytes, signature, trust, now, existing } = {}) {
  requireValid(Array.isArray(existing) && existing.every(key => typeof key === "string"), "ledger");
  requireValid(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_BYTES &&
    Buffer.isBuffer(signature) && signature.length === 64, "size");
  requireValid(trust?.publicKey?.type === "public" && trust.publicKey.asymmetricKeyType === "ed25519" &&
    typeof trust.source === "string" && trust.source.length > 0 &&
    typeof trust.keyId === "string" && trust.keyId.length > 0, "trust");
  requireValid(verify(null, signatureMessage(bytes), trust.publicKey, signature), "signature");

  let text, doc;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    doc = JSON.parse(text);
  } catch {
    throw Error("cal07_encoding");
  }
  requireValid(exactFields(doc, ["schema", "source", "keyId", "gameId", "asOf", "issuedAt", "tables"]) &&
    JSON.stringify(doc) === text && doc.schema === SCHEMA && doc.source === trust.source &&
    doc.keyId === trust.keyId && typeof doc.gameId === "string" && ID.test(doc.gameId), "manifest");
  requireValid([now, doc.asOf, doc.issuedAt].every(iso) && doc.asOf <= doc.issuedAt &&
    doc.issuedAt <= now && Date.parse(now) - Date.parse(doc.asOf) <= MAX_AGE_MS, "freshness");

  const { awayTeam, homeTeam, kickoffAt } = validateRows(doc.tables, doc.gameId, doc.asOf);
  requireValid(inWindow(minutesTo(kickoffAt, now)), "window");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { snapshots } = adaptArchivedGsaxSnapshots(doc.tables.goalieSnapshotRows, { asOf: doc.asOf });
  const assembled = assemblePregameSourceInput({
    ...doc.tables, gameId: doc.gameId, awayTeam, homeTeam, asOf: doc.asOf, now, gsaxSnapshots: snapshots,
  });
  return {
    exportSha256: sha256,
    result: assembled.ready
      ? plan({ payload: assembled.payload, provenance: assembled.provenance, now, existing })
      : assembled,
  };
}

module.exports = { MAX_BYTES, SCHEMA, planSignedExport, signatureMessage };
