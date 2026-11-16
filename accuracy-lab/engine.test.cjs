"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildReport, summarize, models } = require("./engine.js");
const { pairedMetrics } = require("../scripts/core43_paired_evaluation.cjs");

const id = "2026020327";
const scheduledAt = "2026-11-16T01:00:00Z";
const actualStartAt = "2026-11-16T01:08:00Z";
const asOf = "2026-11-16T00:00:00Z";
const pair = (away, home) => ({ away, home });
// Equal component scores fix the reference forecast independently of the valid nominal weights.

function game(gameId = id, ending = "OT") {
  return { id: gameId, date: "2026-11-15", home: "DAL", away: "FLA", scheduledAt, actualStartAt,
    final: pair(1, 2), regulation: pair(1, ending === "REG" ? 2 : 1),
    playedGoals: pair(1, ending === "SO" ? 1 : 2), ending };
}

function forecast(model, at = asOf) {
  return Object.fromEntries(Object.entries({
    version: models[model].version, predicted_at: at, away: 1.5, home: 2.5,
    factors: model === "core42"
      ? { game_start_utc: scheduledAt, method: "late_goalie_snapshot_12h", source: "Feed", feed_age_minutes: 60 }
      : { game_start_utc: scheduledAt, source: "frozen_archive_only",
        method: model === "core40" ? "weighted_available_pregame_snapshots" : "quality_gated_pregame_ensemble",
        inputs: [
        { model: "xg4", away: 1.5, home: 2.5, weight_normalized: 0.4 / 0.55, predicted_at: "2026-11-15T23:00:00Z" },
        { model: "form31", away: 1.5, home: 2.5, weight_normalized: 0.15 / 0.55, predicted_at: "2026-11-15T23:30:00Z" }
      ] }
  }).map(([key, value]) => [model + "_" + key, value]));
}

function fixture(gameIds = [id]) {
  return { scope: { selectedIds: gameIds, cutoff: "2026-11-16T08:00:00Z" },
    games: gameIds.map(key => game(key)),
    archive: gameIds.map(key => ({ game_id: Number(key), game_date: "2026-11-16", home_team: "DAL", away_team: "FLA",
      ...forecast("core40"), ...forecast("core41", "2026-11-16T00:00:00.001Z") })),
    schedules: gameIds.map(key => ({ game_id: key, kickoff_at: scheduledAt, away_team: "FLA", home_team: "DAL" })),
    issues: [] };
}
const group = (data, model, options) => summarize(buildReport(data), options).groups.find(g => g.model === model).metrics[0];
const reasons = raw => buildReport(raw).issues.map(row => row.reason);
const simulated = {
  gameId: id, kind: "simulation", model: "core43", asOf, goals: pair(1, 2), inputs: [],
  probability: { target: "final", values: { away: 0.25, home: 0.75 } }
};

test("joins numeric archive and string NHL IDs, verifies UTC archive date and teams", () => {
  const data = fixture();
  assert.equal(buildReport(data).records.length, 2);
  data.archive[0].game_date = data.games[0].date;
  assert.ok(reasons(data).includes("archive_identity_mismatch"));
  data.archive[0].game_date = "2026-11-16";
  data.archive[0].away_team = "DAL";
  assert.ok(reasons(data).includes("archive_identity_mismatch"));
  data.archive[0].game_id = 2026020999;
  assert.ok(reasons(data).includes("no_public_archive_row"));
});

test("deduplicates identical records and quarantines conflicts permanently within the run", () => {
  const data = fixture();
  data.games.push(structuredClone(data.games[0]));
  data.archive.push(structuredClone(data.archive[0]));
  data.schedules.push(structuredClone(data.schedules[0]));
  assert.equal(buildReport(data).records.length, 2);
  assert.ok(reasons(data).includes("duplicate_game"));
  assert.ok(reasons(data).includes("duplicate_archive"));
  data.archive.push({ ...data.archive[0], core41_away: 7 }, data.archive[0]);
  assert.equal(buildReport(data).records.length, 0);
  assert.ok(reasons(data).includes("conflicting_archive"));
});

test("checks both actual and scheduled cutoff and requires timezone-aware timestamps", () => {
  const data = fixture();
  for (const time of [scheduledAt, "2026-11-16T01:04:00Z", "2026-11-16T00:00:00", "2026-02-30T00:00:00Z"]) {
    data.archive[0].core40_predicted_at = time;
    assert.ok(reasons(data).includes("invalid_or_late_archive_timestamp"));
  }
  data.games[0].actualStartAt = "2026-11-16T00:59:00Z";
  data.archive[0].core40_predicted_at = "2026-11-16T00:59:00Z";
  assert.ok(reasons(data).includes("invalid_or_late_archive_timestamp"));
  data.games[0].actualStartAt = null;
  assert.ok(reasons(data).includes("missing_actual_start_evidence"));
});

test("rejects unknown, future and missing component timestamps and checks reconstructed ensemble", () => {
  const data = fixture();
  const input = data.archive[0].core40_factors.inputs[0];
  input.predicted_at = "2026-11-16T00:00:00.000001Z";
  assert.ok(reasons(data).includes("future_input"));
  input.predicted_at = null;
  assert.ok(reasons(data).includes("missing_input_availability"));
  input.predicted_at = asOf;
  data.archive[0].core40_away = 3;
  assert.ok(reasons(data).includes("archived_goals_disagree_with_components"));
  data.archive[0].core40_version = "unknown";
  assert.ok(reasons(data).includes("unknown_model_version"));
  assert.equal(group(data, "core43").n, 0);
  assert.equal(group(data, "core40", { kind: "reproduced" }).n, 0);
});

test("computes MAE, winner and Wilson bounds; separates shootout from OT and regulation", () => {
  const data = fixture();
  const ot = group(data, "core40");
  assert.equal(ot.mae, 0.5);
  assert.equal(ot.accuracy, 1);
  assert.ok(ot.accuracy95[0] < 1 && ot.accuracy95[1] === 1);
  data.games[0] = game(id, "SO");
  const so = group(data, "core40");
  assert.equal(so.mae, 1);
  assert.equal(so.awayMAE, 0.5);
  assert.equal(so.homeMAE, 1.5);
  assert.equal(so.correct, 1);
  assert.equal(group(data, "core40", { target: "regulation" }).calls, 0);
  data.games[0].playedGoals = data.games[0].final;
  assert.ok(reasons(data).includes("invalid_nhl_result"));
});

test("leaves missing probabilities null; scores reported binary and ternary values in separate targets", () => {
  const data = fixture();
  const frozen = group(data, "core40");
  assert.equal(frozen.probabilityN, 0);
  assert.equal(frozen.brier, null);
  assert.equal(frozen.logLoss, null);
  assert.deepEqual(frozen.calibration, []);
  data.simulations = [structuredClone(simulated)];
  const final = group(data, "core43", { kind: "simulation" });
  assert.equal(final.brier, 0.0625);
  assert.equal(final.logLoss, -Math.log(0.75));
  assert.equal(final.calibration[0].n, 1);
  assert.equal(final.calibration[0].observed, 1);
  assert.equal(group(data, "core43", { kind: "simulation", target: "regulation" }).brier, null);
  data.simulations[0].probability = { target: "regulation", values: { away: 0.25, home: 0.25, draw: 0.5 } };
  const regulation = group(data, "core43", { kind: "simulation", target: "regulation" });
  assert.equal(regulation.correct, 1);
  assert.equal(regulation.brier, 0.375);
});

test("pairs on exact game and information instant and matches existing paired MAE on comparable goals", () => {
  const data = fixture([id, "2026020328", "2026020329"]);
  delete data.archive[1].core40_away;
  delete data.archive[1].core40_home;
  delete data.archive[2].core41_away;
  delete data.archive[2].core41_home;
  const compare = () => summarize(buildReport(data)).comparisons[0];
  assert.deepEqual(compare().sameGames.gameIds, [id]);
  assert.equal(compare().sameInstant.n, 0);
  data.archive[0].core41_predicted_at = "2026-11-15T19:00:00-05:00";
  const paired = compare();
  assert.equal(paired.sameInstant.n, 1);
  assert.equal(paired.sameSnapshot.n, 1);
  const a = { away: 1.5, home: 2.5, predictedAt: asOf };
  const existing = pairedMetrics([{ gameId: id, kickoffAt: scheduledAt, actual: pair(1, 2), core40: a, core41: a }],
    { baseline: "core40", challenger: "core41" });
  assert.deepEqual(paired.sameGames.mae, [existing.baselineMAE, existing.challengerMAE]);
  assert.equal(summarize(buildReport(data), { team: "EDM" }).records.length, 0);
});

test("preserves simulation labels and rejects unsupported historical imports and postgame inputs", () => {
  const data = fixture();
  data.simulations = [structuredClone(simulated)];
  assert.equal(group(data, "core43").n, 0);
  assert.equal(group(data, "core43", { kind: "simulation" }).n, 1);
  data.simulations[0].inputs = [{ role: "postgame", name: "score", source: "NHL", availableAt: null }];
  assert.ok(reasons(data).includes("forbidden_input_role"));
  data.simulations[0].inputs = [{ role: "pregame", name: "goalie", source: "RotoWire", availableAt: actualStartAt }];
  assert.ok(reasons(data).includes("future_input"));
  data.simulations[0].kind = "reproduced";
  assert.ok(reasons(data).includes("invalid_simulation_or_unsupported_historical_import"));
});

test("identifies CORE 4.2 coverage without promoting its upstream inputs", () => {
  const data = fixture();
  Object.assign(data.archive[0], forecast("core42"));
  assert.deepEqual(group(data, "core42").evidence, ["archive_timestamp_only"]);
  assert.ok(reasons(data).includes("goalie_and_upstream_input_timestamps_not_independently_documented"));
  assert.equal(summarize(buildReport(data)).comparisons.find(p => p.models.join() === "core40,core42").sameSnapshot.n, 0);
});
