"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluate, predictionDigest, toMarkdown } = require("./core43_cal11_evaluate.cjs");
const { planSignedExport } = require("./core43_cal07_export.cjs");
const { at, fixture, now, signed } = require("./fixtures/core43_signed_export.cjs");

const target = "home_win_including_ot_so";
function sample(gameId = "2026020293", origin = "simulation") {
  const input = signed(fixture(now, { gameId, away: "TBL", home: "BUF", baseline: [3.54, 3.16],
    goalsAgainst: [55, 45] }));
  const result = planSignedExport(input).result;
  assert.equal(result.ready, true);
  const record = result.variants[0].record;
  const predictions = {
    gameId, origin, kickoffAt: record.kickoffAt, frozenAt: record.frozenAt,
    awayTeam: record.awayTeam, homeTeam: record.homeTeam, core42: { ...record.baseline },
    variants: result.variants.map(({ record: { coefficient, inputAsOf, predictedAt, away, home } }) =>
      ({ coefficient, inputAsOf, predictedAt, away, home })),
  };
  const outcomes = {
    origin, sourceUrl: origin === "simulation" ? "fixture" : `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`,
    boxscore: {
      id: Number(gameId), startTimeUTC: record.kickoffAt.replace(".000Z", "Z"), gameState: "OFF",
      gameOutcome: { lastPeriodType: "REG" },
      awayTeam: { abbrev: "TBL", score: 8 }, homeTeam: { abbrev: "BUF", score: 3 },
    },
  };
  if (origin === "historical") outcomes.officialStart = {
    at: at("23:07"), url: `https://www.nhl.com/scores/htmlreports/20262027/GS${gameId.slice(4)}.HTM`,
  };
  return { predictions, outcomes };
}

function proof(predictions, observedAt = at("22:01")) {
  return { gameId: predictions.gameId, observedAt, sha256: predictionDigest(predictions), archiveRef: "unit-test-pre-game-audit" };
}

function report(...samples) {
  return evaluate({
    predictions: samples.map(s => s.predictions), outcomes: samples.map(s => s.outcomes),
    evidence: samples.flatMap(s => s.evidence ?? []),
  });
}

function setProbability(row, probabilities) {
  for (const [i, forecast] of [row.core42, ...row.variants].entries()) {
    forecast.homeWinProbability = probabilities[i];
    forecast.probabilityTarget = target;
  }
}

test("reuses CAL-07 forecasts on identical games without turning goal counts into probabilities", () => {
  const one = sample();
  const two = sample("2026020294");
  const { cohorts } = report(one, two);
  const simulation = cohorts[1];
  assert.deepEqual(simulation.pairedGameIds, [one.predictions.gameId, two.predictions.gameId]);
  assert.deepEqual(simulation.winnerGameIds, simulation.pairedGameIds);
  assert.deepEqual(simulation.probabilityGameIds, []);
  assert.deepEqual(simulation.metrics.map(m => m.winnerAccuracy), [1, 1, 1, 1, 1]);
  assert.ok(simulation.metrics.every(m => m.brier === null && m.logLoss === null));
  assert.equal(cohorts[0].pairedGames, 0);
});

test("Brier and log loss use only games with matching target probabilities for all models", () => {
  const loss = sample();
  const win = sample("2026020294");
  const incomplete = sample("2026020295");
  win.outcomes.boxscore.homeTeam.score = 3;
  win.outcomes.boxscore.awayTeam.score = 2;
  win.outcomes.boxscore.gameOutcome.lastPeriodType = "SO";
  setProbability(loss.predictions, [0.25, 0.5, 0.2, 0.3, 0.4]);
  setProbability(win.predictions, [0.75, 0.5, 0.8, 0.7, 0.6]);
  for (const forecast of incomplete.predictions.variants) {
    forecast.homeWinProbability = 0.35;
    forecast.probabilityTarget = target;
  }

  const { metrics, probabilityGameIds, winnerGameIds } = report(loss, win, incomplete).cohorts[1];
  assert.deepEqual(probabilityGameIds, ["2026020293", "2026020294"]);
  assert.equal(winnerGameIds.length, 3);
  const expected = [0.25, 0.5, 0.2, 0.3, 0.4];
  for (const [i, row] of metrics.entries()) {
    assert.equal(row.probabilityGames, 2);
    assert.ok(Math.abs(row.brier - expected[i] ** 2) < 1e-12);
    assert.ok(Math.abs(row.logLoss + Math.log(1 - expected[i])) < 1e-12);
    assert.ok(Math.abs(row.winnerAccuracy - 2 / 3) < 1e-12);
  }
});

test("wrong probability target is rejected and certain wrong forecasts have finite capped log loss", () => {
  const s = sample();
  setProbability(s.predictions, [1, 1, 1, 1, 1]);
  const summary = report(s);
  assert.ok(summary.cohorts[1].metrics.every(m => m.brier === 1 && m.logLoss === -Math.log(summary.logLossFloor)));
  s.predictions.variants[0].probabilityTarget = "regulation_only";
  assert.deepEqual(report(s).cohorts[1].excluded, { incomplete_or_invalid_forecasts: 1 });
});

test("score ties omit the game from the winner denominator for every model", () => {
  const s = sample();
  s.predictions.variants[2].away = s.predictions.variants[2].home;
  const cohort = report(s).cohorts[1];
  assert.equal(cohort.pairedGames, 1);
  assert.ok(cohort.metrics.every(m => m.winnerGames === 0 && m.winnerAccuracy === null));
});

test("historical eligibility requires independent pregame evidence and exact frozen bytes", () => {
  const s = sample("2026020293", "historical");
  assert.deepEqual(report(s).cohorts[0].excluded, { missing_or_invalid_pregame_evidence: 1 });
  s.evidence = [proof(s.predictions)];
  assert.equal(report(s).cohorts[0].pairedGames, 1);
  s.predictions.variants[2].away += 0.1;
  assert.deepEqual(report(s).cohorts[0].excluded, { missing_or_invalid_pregame_evidence: 1 });
  s.evidence = [proof(s.predictions, at("23:00"))];
  assert.deepEqual(report(s).cohorts[0].excluded, { missing_or_invalid_pregame_evidence: 1 });
  s.evidence = [proof(s.predictions)];
  s.outcomes.officialStart.at = at("22:00");
  assert.deepEqual(report(s).cohorts[0].excluded, { capture_not_before_actual_start: 1 });
});

test("rejects late inputs, final result fields in a forecast and a different control baseline", () => {
  for (const [edit, reason] of [
    [s => { s.variants[1].inputAsOf = at("22:01"); }, "invalid_pregame_timing"],
    [s => { s.variants[1].inputAsOf = s.variants[1].predictedAt = at("21:59"); }, "unequal_variant_cutoff"],
    [s => { s.variants[1].actual = 8; }, "incomplete_or_invalid_forecasts"],
    [s => { s.variants[0].away += 0.01; }, "inconsistent_core42_baseline"],
    [s => { s.variants.pop(); }, "incomplete_or_invalid_forecasts"],
  ]) {
    const s = sample();
    edit(s.predictions);
    assert.deepEqual(report(s).cohorts[1].excluded, { [reason]: 1 });
  }
});

test("requires a verified final, rejects duplicate files and never mixes origins", () => {
  const historical = sample("2026020293", "historical");
  const simulation = sample();
  const recomputed = sample("2026020293", "recomputed");
  const result = report(historical, simulation, recomputed);
  assert.deepEqual(result.cohorts.map(x => x.pairedGames), [0, 1, 1]);
  assert.deepEqual(report(simulation, simulation).cohorts[1].excluded, { duplicate_prediction: 1 });
  for (const edit of [
    boxscore => { boxscore.gameState = "LIVE"; },
    boxscore => { boxscore.startTimeUTC = "2026-11-10T23:00:00Z"; },
    boxscore => { boxscore.awayTeam.abbrev = "DAL"; },
    boxscore => { boxscore.gameOutcome.lastPeriodType = "OT"; },
  ]) {
    const s = sample();
    edit(s.outcomes.boxscore);
    assert.deepEqual(report(s).cohorts[1].excluded, { missing_conflicting_or_mismatched_final: 1 });
  }
  assert.deepEqual(evaluate({
    predictions: [simulation.predictions], outcomes: [simulation.outcomes, simulation.outcomes],
  }).cohorts[1].excluded, { missing_conflicting_or_mismatched_final: 1 });
});

test("empty actual inputs show N/A rather than a zero accuracy estimate", () => {
  const result = evaluate();
  assert.ok(result.cohorts.every(c => c.pairedGames === 0));
  assert.match(toMarkdown(result), /historical \| core43:0\.03 \| 0 \| 0 \| N\/A \| N\/A \| 0 \/ 0 \| N\/A/);
});
