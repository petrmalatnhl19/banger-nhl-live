"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { COEFFICIENTS } = require("./core43_cal03_capture_plan.cjs");

const ORIGINS = ["historical", "simulation", "recomputed"];
const MODELS = ["core42", ...COEFFICIENTS.map(c => "core43:" + c)];
const TARGET = "home_win_including_ot_so";
const EPSILON = 1e-15;
const NHL = "https://api-web.nhle.com/v1/gamecenter/";
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const gameId = value => typeof value === "string" && /^\d{10}$/.test(value);
const team = value => typeof value === "string" && /^[A-Z]{3}$/.test(value);

function fields(value, required, optional = []) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}

// The digest is over the archived JSON representation, including the origin and all forecasts.
function predictionDigest(row) {
  return createHash("sha256").update(JSON.stringify(row)).digest("hex");
}

function indexUnique(rows, keyFor) {
  const index = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    index.set(key, index.has(key) ? null : row);
  }
  return index;
}

function finalOutcome(row, origin) {
  if (!fields(row, ["origin", "sourceUrl", "boxscore"], ["officialStart"]) || row.origin !== origin) return null;
  const { boxscore: b } = row;
  const id = String(b?.id);
  const kickoff = typeof b?.startTimeUTC === "string" ? b.startTimeUTC.replace(/(\d{2}:\d{2}:\d{2})Z$/, "$1.000Z") : null;
  if (!gameId(id) || !instant(kickoff) || !["OFF", "FINAL"].includes(b.gameState) ||
      !["REG", "OT", "SO"].includes(b.gameOutcome?.lastPeriodType) ||
      !team(b.awayTeam?.abbrev) || !team(b.homeTeam?.abbrev) || b.homeTeam.abbrev === b.awayTeam.abbrev ||
      ![b.awayTeam.score, b.homeTeam.score].every(score => Number.isSafeInteger(score) && score >= 0) ||
      b.awayTeam.score === b.homeTeam.score ||
      (origin !== "simulation" && row.sourceUrl !== NHL + id + "/boxscore") ||
      (origin === "simulation" && row.sourceUrl !== "fixture")) return null;
  const margin = Math.abs(b.homeTeam.score - b.awayTeam.score);
  if (b.gameOutcome.lastPeriodType !== "REG" && margin !== 1) return null;
  const officialStart = row.officialStart;
  if (origin === "historical" || officialStart !== undefined) {
    const season = Number(id.slice(0, 4));
    const reportUrl = `https://www.nhl.com/scores/htmlreports/${season}${season + 1}/GS${id.slice(4)}.HTM`;
    if (!fields(officialStart, ["at", "url"]) || !instant(officialStart.at) || officialStart.url !== reportUrl) return null;
  }
  return { kickoff, startedAt: officialStart?.at ?? kickoff, awayTeam: b.awayTeam.abbrev, homeTeam: b.homeTeam.abbrev,
    homeWin: Number(b.homeTeam.score > b.awayTeam.score) };
}

function validForecast(row, extra = []) {
  return fields(row, ["predictedAt", "away", "home", ...extra], ["homeWinProbability", "probabilityTarget"]) &&
    instant(row.predictedAt) && [row.away, row.home].every(x => Number.isFinite(x) && x >= 0 && x <= 20.2) &&
    (Object.hasOwn(row, "homeWinProbability")
      ? row.probabilityTarget === TARGET && Number.isFinite(row.homeWinProbability) &&
        row.homeWinProbability >= 0 && row.homeWinProbability <= 1
      : !Object.hasOwn(row, "probabilityTarget"));
}

// Evaluate only frozen outputs. Neither finals nor their scores are inputs to a model.
function validatePrediction(row) {
  if (!fields(row, ["origin", "gameId", "kickoffAt", "frozenAt", "awayTeam", "homeTeam", "core42", "variants"]) ||
      !gameId(row.gameId) || !instant(row.kickoffAt) || !instant(row.frozenAt) ||
      !team(row.awayTeam) || !team(row.homeTeam) || row.awayTeam === row.homeTeam ||
      !validForecast(row.core42) || !Array.isArray(row.variants) ||
      row.variants.length !== COEFFICIENTS.length ||
      !row.variants.every(v => validForecast(v, ["coefficient", "inputAsOf"]) && instant(v.inputAsOf)) ||
      !COEFFICIENTS.every(c => row.variants.filter(v => v.coefficient === c).length === 1)) return "incomplete_or_invalid_forecasts";
  const control = row.variants.find(v => v.coefficient === 0);
  if (["away", "home"].some(side => Math.round(row.core42[side] * 1000) / 1000 !== control[side])) {
    return "inconsistent_core42_baseline";
  }
  if (row.frozenAt >= row.kickoffAt || row.variants.some(v =>
    row.core42.predictedAt > v.inputAsOf || v.inputAsOf > v.predictedAt || v.predictedAt > row.frozenAt)) {
    return "invalid_pregame_timing";
  }
  if (row.variants.some(v => v.inputAsOf !== control.inputAsOf || v.predictedAt !== control.predictedAt)) {
    return "unequal_variant_cutoff";
  }
  return null;
}

function evaluate({ predictions = [], evidence = [], outcomes = [] } = {}) {
  if (![predictions, evidence, outcomes].every(Array.isArray)) throw Error("Expected three offline arrays");
  const outcomeIndex = indexUnique(outcomes, row => row?.origin + ":" + row?.boxscore?.id);
  const proofIndex = indexUnique(evidence, row => row?.gameId);
  const forecastIndex = indexUnique(predictions, row => row?.origin + ":" + row?.gameId);
  const cohorts = ORIGINS.map(origin => {
    const pairs = [];
    const excluded = {};
    function exclude(reason) {
      excluded[reason] = (excluded[reason] || 0) + 1;
    }
    for (const [key, row] of forecastIndex) {
      if (!key.startsWith(origin + ":")) continue;
      if (!row) { exclude("duplicate_prediction"); continue; }
      const invalid = validatePrediction(row);
      if (invalid) { exclude(invalid); continue; }
      const proof = proofIndex.get(row.gameId);
      if (origin === "historical") {
        if (!fields(proof, ["gameId", "sha256", "observedAt", "archiveRef"]) ||
            typeof proof.archiveRef !== "string" || !proof.archiveRef.trim() ||
            !instant(proof.observedAt) || proof.sha256 !== predictionDigest(row) ||
            proof.observedAt < row.frozenAt || proof.observedAt >= row.kickoffAt) {
          exclude("missing_or_invalid_pregame_evidence");
          continue;
        }
      }
      const actual = finalOutcome(outcomeIndex.get(key), origin);
      if (!actual || actual.kickoff !== row.kickoffAt ||
          actual.awayTeam !== row.awayTeam || actual.homeTeam !== row.homeTeam) {
        exclude("missing_conflicting_or_mismatched_final");
        continue;
      }
      if (row.frozenAt >= actual.startedAt || (origin === "historical" && proof.observedAt >= actual.startedAt)) {
        exclude("capture_not_before_actual_start");
        continue;
      }
      const forecasts = [row.core42, ...COEFFICIENTS.map(c => row.variants.find(v => v.coefficient === c))];
      pairs.push({ gameId: row.gameId, y: actual.homeWin, forecasts });
    }

    const probabilityPairs = pairs.filter(pair => pair.forecasts.every(f => f.homeWinProbability !== undefined));
    const winnerPairs = pairs.filter(pair => pair.forecasts.every(f => f.away !== f.home));
    const mean = (rows, score) => rows.length ? rows.reduce((sum, row) => sum + score(row), 0) / rows.length : null;
    return {
      origin, pairedGames: pairs.length, excluded,
      pairedGameIds: pairs.map(pair => pair.gameId).sort(),
      probabilityGameIds: probabilityPairs.map(pair => pair.gameId).sort(),
      winnerGameIds: winnerPairs.map(pair => pair.gameId).sort(),
      metrics: MODELS.map((model, index) => {
        const correct = winnerPairs.filter(({ forecasts, y }) =>
          Number(forecasts[index].home > forecasts[index].away) === y).length;
        return {
          model, probabilityGames: probabilityPairs.length,
          brier: mean(probabilityPairs, ({ forecasts, y }) => (forecasts[index].homeWinProbability - y) ** 2),
          logLoss: mean(probabilityPairs, ({ forecasts, y }) => {
            const p = forecasts[index].homeWinProbability;
            const assigned = y ? p : 1 - p;
            return -Math.log(Math.max(EPSILON, assigned));
          }),
          winnerGames: winnerPairs.length, correctWinners: correct,
          winnerAccuracy: winnerPairs.length ? correct / winnerPairs.length : null,
        };
      }),
    };
  });
  return {
    target: TARGET, winnerRule: "higher_expected_goals", logLossFloor: EPSILON, cohorts,
    unclassifiedPredictions: predictions.filter(row => !ORIGINS.includes(row?.origin)).length,
  };
}

function toMarkdown(report) {
  const format = n => n === null ? "N/A" : n.toFixed(4);
  return ["# CORE43-CAL-11 offline evaluation",
    "", "Winner pick uses the side with higher expected goals. Probability metrics use archived home-win probabilities.",
    "", "| Cohort | Model | Paired games | Prob. games | Brier | Log loss | Correct / winner games | Winner accuracy |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.cohorts.flatMap(c => c.metrics.map(m =>
      `| ${c.origin} | ${m.model} | ${c.pairedGames} | ${m.probabilityGames} | ${format(m.brier)} | ${format(m.logLoss)} | ${m.correctWinners} / ${m.winnerGames} | ${format(m.winnerAccuracy)} |`)),
    "", "Excluded rows and sample limitations", "",
    ...report.cohorts.map(c => `- ${c.origin}: ${JSON.stringify(c.excluded)}`),
    `- Unclassified predictions: ${report.unclassifiedPredictions}`,
    "", "An empty cohort has no accuracy estimate. Simulation and recomputation do not establish historical performance.",
  ].join("\n");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  try {
    if (args.length !== 3 && !(args.length === 4 && args[3] === "--markdown")) throw Error("usage");
    const [predictions, evidence, outcomes] = args.slice(0, 3).map(path => JSON.parse(readFileSync(path, "utf8")));
    const report = evaluate({ predictions, evidence, outcomes });
    console.log(args[3] === "--markdown" ? toMarkdown(report) : JSON.stringify(report, null, 2));
  } catch {
    console.error("Usage: node scripts/core43_cal11_evaluate.cjs predictions.json trusted-pregame-evidence.json outcomes.json [--markdown]");
    process.exitCode = 1;
  }
}

module.exports = { evaluate, predictionDigest, toMarkdown };
