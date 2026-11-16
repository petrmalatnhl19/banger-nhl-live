/* Shared by the offline evaluator and the standalone dashboard. */
(function (root) {
  "use strict";
  const models = {
    core40: { label: "CORE 4.0", version: "banger-core-v4.0-pregame-ensemble",
      availability: "Archiv a kontrola váženého součtu zmrazených komponent" },
    core41: { label: "CORE 4.1", version: "banger-core-v4.1-quality-gated",
      availability: "Archiv a kontrola váženého součtu vybraných komponent" },
    core42: { label: "CORE 4.2", version: "banger-core-v4.2-late-goalie",
      availability: "Archiv, časy jednotlivých vstupů nejsou úplné" },
    core43: { label: "CORE 4.3", version: null,
      availability: "Experimentální GSAx varianty, bez ověřeného veřejného archivu pro pilot" }
  };
  const kinds = ["archived", "reproduced", "simulation"];
  const componentWeights = { xg4: 0.4, goalie32: 0.25, special33: 0.2, form31: 0.15 };
  const targets = ["final", "regulation"];
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const side = (away, home) => home > away ? "home" : away > home ? "away" : "draw";
  const gameId = id => /^\d{10}$/.test(String(id)) ? String(id) : null;
  function timestamp(value) {
    if (typeof value !== "string") return NaN;
    const parts = /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!parts || +parts[3] < 1 || +parts[3] > new Date(Date.UTC(+parts[1], +parts[2], 0)).getUTCDate()) return NaN;
    const micros = Number((parts[4] ?? "").padEnd(6, "0").slice(3));
    return Date.parse(value) + micros / 1000;
  }
  const goals = value => Number.isFinite(value) && value >= 0 && value <= 20;
  const pairs = value => value && [value.away, value.home].every(goals);
  const score = value => pairs(value) && [value.away, value.home].every(Number.isInteger);
  const text = value => typeof value === "string" && value.trim().length > 0;

  function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function unique(rows, keyOf, label, issues) {
    const uniqueRows = new Map();
    const conflicts = new Set();
    for (const row of rows) {
      const key = keyOf(row);
      if (!key) {
        issues.push({ reason: "invalid_" + label + "_key" });
      } else if (conflicts.has(key) || uniqueRows.has(key)) {
        const identical = !conflicts.has(key) && canonical(row) === canonical(uniqueRows.get(key));
        issues.push({ key, reason: identical ? "duplicate_" + label : "conflicting_" + label });
        if (!identical) {
          uniqueRows.delete(key);
          conflicts.add(key);
        }
      } else {
        uniqueRows.set(key, row);
      }
    }
    return uniqueRows;
  }

  function resultValid(game) {
    if (!["REG", "OT", "SO"].includes(game.ending) || !score(game.final)
      || !score(game.regulation) || !score(game.playedGoals) || !Number.isFinite(timestamp(game.scheduledAt))) return false;
    const winner = side(game.final.away, game.final.home);
    if (winner === "draw") return false;
    const other = winner === "home" ? "away" : "home";
    if (game.final[other] !== game.regulation[other]) return false;
    if (game.ending === "REG") {
      return game.final[winner] === game.regulation[winner] && canonical(game.final) === canonical(game.playedGoals);
    }
    return game.regulation.away === game.regulation.home && game.final[winner] === game.regulation[winner] + 1
      && canonical(game.ending === "SO" ? game.regulation : game.final) === canonical(game.playedGoals);
  }

  function kickoff(game) {
    const actual = timestamp(game.actualStartAt);
    const scheduled = timestamp(game.scheduledAt);
    return Number.isFinite(actual) && actual % 60000 === 0 && Math.abs(actual - scheduled) <= 3 * 3600000
      ? Math.min(actual, scheduled) : NaN;
  }

  function checkInput(input, at) {
    if (!input || !text(input.name) || !text(input.source)) return "missing_input_provenance";
    if (input.role !== "pregame") return "forbidden_input_role";
    const available = timestamp(input.availableAt);
    if (!Number.isFinite(available)) return "missing_input_availability";
    return available > at ? "future_input" : null;
  }

  function ensembleEvidence(factors, at, model) {
    if (factors?.source !== "frozen_archive_only" || !Array.isArray(factors.inputs) || !factors.inputs.length) {
      return { reason: "missing_frozen_components" };
    }
    const method = model === "core40" ? "weighted_available_pregame_snapshots" : "quality_gated_pregame_ensemble";
    if (factors.method !== method) return { reason: "unknown_ensemble_method" };
    const inputs = factors.inputs.map(value => ({ name: value?.model, role: "pregame",
      source: "nhl_prediction_archive.frozen_archive_only", availableAt: value?.predicted_at,
      away: value?.away, home: value?.home, weight: value?.weight_normalized }));
    for (const input of inputs) {
      const reason = checkInput(input, at);
      if (reason) return { reason };
      if (!Object.hasOwn(componentWeights, input.name) || !pairs(input)
        || !Number.isFinite(input.weight) || input.weight <= 0) return { reason: "invalid_component" };
    }
    const names = new Set(inputs.map(input => input.name));
    const nominal = inputs.reduce((sum, input) => sum + componentWeights[input.name], 0);
    if (names.size !== inputs.length || names.size < 2 || !names.has("xg4")
      || inputs.some(input => Math.abs(input.weight - componentWeights[input.name] / nominal) > 1e-7)) {
      return { reason: "invalid_ensemble_weights" };
    }
    return { inputs, replay: Object.fromEntries(["away", "home"].map(key => [
      key, inputs.reduce((sum, input) => sum + input[key] * input.weight, 0)
    ])) };
  }

  function extractArchive(row, model, game, schedule) {
    const read = key => row[model + "_" + key];
    const prediction = { away: read("away"), home: read("home") };
    const at = timestamp(read("predicted_at"));
    const boundary = kickoff(game);
    if (!pairs(prediction)) return { reason: "invalid_predicted_goals" };
    if (read("version") !== models[model].version) return { reason: "unknown_model_version" };
    if (!schedule || schedule.away_team !== game.away || schedule.home_team !== game.home
      || timestamp(schedule.kickoff_at) !== timestamp(game.scheduledAt)) return { reason: "missing_or_conflicting_schedule" };
    if (!Number.isFinite(boundary)) return { reason: "missing_actual_start_evidence" };
    if (!Number.isFinite(at) || at >= boundary) return { reason: "invalid_or_late_archive_timestamp" };
    const factors = read("factors");
    if (timestamp(factors?.game_start_utc) !== timestamp(game.scheduledAt)) {
      return { reason: "missing_or_conflicting_factors_kickoff" };
    }
    const record = { gameId: game.id, model, kind: "archived", asOf: read("predicted_at"),
      version: read("version"), goals: prediction, probability: null,
      evidence: "component_timestamps", inputs: [], goalieStatus: null, goalTarget: "playedGoals" };
    if (model === "core42") {
      const hoursBeforeScheduled = (timestamp(game.scheduledAt) - at) / 3600000;
      if (factors.method !== "late_goalie_snapshot_12h" || !text(factors.source)
        || !Number.isFinite(factors.feed_age_minutes) || factors.feed_age_minutes < 0 || factors.feed_age_minutes > 360
        || hoursBeforeScheduled > 12) {
        return { reason: "invalid_late_goalie_provenance" };
      }
      record.evidence = "archive_timestamp_only";
      record.goalieStatus = Object.fromEntries(["away", "home"].map(team => {
        const value = factors[team + "_goalie"];
        return [team, value ? { name: value.name ?? null, status: value.status ?? null,
          playerId: value.nhl_player_id ?? null, identitySource: value.identity_source ?? null } : null];
      }));
      record.source = factors.source;
      record.feedAgeMinutes = factors.feed_age_minutes;
      return { record, warning: "goalie_and_upstream_input_timestamps_not_independently_documented" };
    }
    const evidence = ensembleEvidence(factors, at, model);
    if (evidence.reason) return evidence;
    if (["away", "home"].some(key => Math.abs(prediction[key] - evidence.replay[key]) > 1e-7)) {
      return { reason: "archived_goals_disagree_with_components" };
    }
    record.inputs = evidence.inputs;
    record.source = factors.source;
    return { record };
  }

  function simulation(row, game) {
    if (row.kind !== "simulation" || !Object.hasOwn(models, row.model) || !pairs(row.goals)) {
      return { reason: "invalid_simulation_or_unsupported_historical_import" };
    }
    const at = timestamp(row.asOf);
    const boundary = kickoff(game);
    if (!Number.isFinite(boundary) || !Number.isFinite(at) || at >= boundary || !Array.isArray(row.inputs)) {
      return { reason: "invalid_simulation_cutoff" };
    }
    for (const input of row.inputs) {
      const reason = checkInput(input, at);
      if (reason && reason !== "missing_input_availability" && reason !== "missing_input_provenance") return { reason };
      if (input?.role !== "pregame") return { reason: "forbidden_input_role" };
      if (timestamp(input?.availableAt) > at) return { reason: "future_input" };
    }
    if (row.probability != null) {
      const { target, values } = row.probability;
      const keys = target === "final" ? ["away", "home"] : ["away", "home", "draw"];
      if (!targets.includes(target) || !values || Object.keys(values).length !== keys.length || !keys.every(key =>
        Number.isFinite(values[key]) && values[key] >= 0 && values[key] <= 1)
        || Math.abs(keys.reduce((total, key) => total + values[key], 0) - 1) > 1e-9) {
        return { reason: "invalid_probability" };
      }
    }
    return { record: { gameId: game.id, model: row.model, version: row.version ?? null, kind: "simulation",
      asOf: row.asOf, goals: row.goals, goalTarget: row.goalTarget === "regulation" ? "regulation" : "playedGoals",
      evidence: "simulation", inputs: row.inputs, probability: row.probability ?? null } };
  }

  function buildReport(raw) {
    for (const field of ["games", "archive", "schedules", "issues"]) {
      if (!Array.isArray(raw[field])) throw Error("Invalid collection field " + field);
    }
    if (!Array.isArray(raw.scope?.selectedIds) || (raw.simulations != null && !Array.isArray(raw.simulations))) {
      throw Error("Invalid collection scope or simulation list");
    }
    const selected = new Set(raw.scope.selectedIds);
    if (!selected.size || selected.size !== raw.scope.selectedIds.length || ![...selected].every(gameId)
      || !Number.isFinite(timestamp(raw.scope.cutoff))) {
      throw Error("Invalid selected NHL game IDs");
    }
    const issues = raw.issues.slice();
    const games = unique(raw.games, row => gameId(row?.id), "game", issues);
    for (const [id, game] of games) {
      if (!resultValid(game) || !/^\d{4}-\d{2}-\d{2}$/.test(game.date) || game.home === game.away || ![game.away, game.home].every(x => /^[A-Z]{3}$/.test(x))
        || !selected.has(id) || timestamp(game.scheduledAt) >= timestamp(raw.scope.cutoff)) {
        issues.push({ gameId: id, reason: "invalid_nhl_result" });
        games.delete(id);
      }
    }
    const archive = unique(raw.archive, row => gameId(row?.game_id), "archive", issues);
    const schedules = unique(raw.schedules, row => gameId(row?.game_id), "schedule", issues);
    const records = [];
    for (const [id, game] of games) {
      const row = archive.get(id);
      if (!row) {
        issues.push({ gameId: id, reason: "no_public_archive_row" });
        continue;
      }
      if (row.away_team !== game.away || row.home_team !== game.home || row.game_date !== new Date(timestamp(game.scheduledAt)).toISOString().slice(0, 10)) {
        issues.push({ gameId: id, reason: "archive_identity_mismatch" });
        continue;
      }
      for (const model of ["core40", "core41", "core42"]) {
        if (row[model + "_away"] == null && row[model + "_home"] == null) {
          issues.push({ gameId: id, model, reason: "forecast_missing" });
          continue;
        }
        const { record, reason, warning } = extractArchive(row, model, game, schedules.get(id));
        if (record) records.push(record);
        if (reason || warning) issues.push({ gameId: id, model, reason: reason || warning, ...(warning && { warning: true }) });
      }
    }
    const simulations = unique(raw.simulations ?? [], row =>
      gameId(row?.gameId) && Object.hasOwn(models, row.model) ? row.gameId + "/" + row.model : null, "simulation", issues);
    for (const [key, row] of simulations) {
      const game = games.get(String(row.gameId));
      const { record, reason } = game ? simulation(row, game) : { reason: "simulation_result_missing" };
      if (record) records.push(record);
      else issues.push({ key, reason });
    }
    return { schema: "banger-core-accuracy-01", scope: raw.scope, games: [...games.values()], records, issues };
  }

  function observation(record, game, target) {
    const actual = side(game[target].away, game[target].home);
    const goalActual = game[record.goalTarget];
    const awayError = Math.abs(record.goals.away - goalActual.away);
    const homeError = Math.abs(record.goals.home - goalActual.home);
    const values = record.probability?.target === target ? record.probability.values : null;
    const ranking = values ? Object.keys(values).sort((a, b) => values[b] - values[a]) : [];
    const winner = values
      ? (values[ranking[0]] > values[ranking[1]] ? ranking[0] : null)
      : (target === "final" ? side(record.goals.away, record.goals.home) : null);
    const call = winner != null && (winner !== "draw" || target === "regulation");
    return { record, actual, winner: call ? winner : null, correct: call ? Number(winner === actual) : null,
      awayError, homeError, mae: (awayError + homeError) / 2,
      brier: values ? Object.keys(values).reduce((sum, key) =>
        sum + (values[key] - Number(actual === key)) ** 2, 0) / (target === "final" ? 2 : 1) : null,
      logLoss: values ? -Math.log(Math.max(1e-15, values[actual])) : null,
      homeProbability: values?.home ?? null };
  }

  function wilson(success, n) {
    if (!n) return null;
    const p = success / n, z2 = 1.96 ** 2;
    const center = (p + z2 / (2 * n)) / (1 + z2 / n);
    const half = 1.96 * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n) / (1 + z2 / n);
    return [Math.max(0, center - half), Math.min(1, center + half)];
  }

  function metrics(rows) {
    const called = rows.filter(row => row.correct !== null);
    const success = called.reduce((sum, row) => sum + row.correct, 0);
    const bins = Array.from({ length: 5 }, () => []);
    for (const row of rows) {
      if (row.homeProbability !== null) bins[Math.min(4, Math.floor(row.homeProbability * 5))].push(row);
    }
    return { n: rows.length, calls: called.length, correct: success, accuracy: mean(called.map(row => row.correct)),
      accuracy95: wilson(success, called.length),
      awayMAE: mean(rows.map(row => row.awayError)), homeMAE: mean(rows.map(row => row.homeError)),
      mae: mean(rows.map(row => row.mae)), probabilityN: bins.flat().length,
      brier: mean(rows.flatMap(row => row.brier === null ? [] : [row.brier])),
      logLoss: mean(rows.flatMap(row => row.logLoss === null ? [] : [row.logLoss])),
      calibration: bins.flatMap((bin, i) => {
        if (!bin.length) return [];
        const wins = bin.filter(row => row.actual === "home").length;
        return [{ from: i / 5, to: (i + 1) / 5, n: bin.length, predicted: mean(bin.map(row => row.homeProbability)),
          observed: wins / bin.length, observed95: wilson(wins, bin.length) }];
      }) };
  }

  function compare(left, right) {
    const byId = new Map(right.map(row => [row.record.gameId, row]));
    const shared = left.flatMap(row => byId.has(row.record.gameId) ? [[row, byId.get(row.record.gameId)]] : []);
    function describe(pairs) {
      // Both models use exactly the same rows for each head-to-head statistic.
      const sameGoalTarget = pairs.filter(([a, b]) => a.record.goalTarget === b.record.goalTarget);
      const bothCalled = pairs.filter(([a, b]) => a.correct !== null && b.correct !== null);
      const bothProb = pairs.filter(([a, b]) => a.brier !== null && b.brier !== null);
      return { n: pairs.length, gameIds: pairs.map(([a]) => a.record.gameId),
        goalsN: sameGoalTarget.length, mae: [0, 1].map(i => mean(sameGoalTarget.map(p => p[i].mae))),
        callsN: bothCalled.length, accuracy: [0, 1].map(i => mean(bothCalled.map(p => p[i].correct))),
        probabilityN: bothProb.length, brier: [0, 1].map(i => mean(bothProb.map(p => p[i].brier))),
        logLoss: [0, 1].map(i => mean(bothProb.map(p => p[i].logLoss))) };
    }
    const coincident = shared.filter(([a, b]) => timestamp(a.record.asOf) === timestamp(b.record.asOf));
    const documentedInputs = record => canonical(record.inputs.map(({ weight, ...input }) => input)
      .sort((a, b) => a.name.localeCompare(b.name)));
    return { sameGames: describe(shared), sameInstant: describe(coincident),
      sameSnapshot: describe(coincident.filter(([a, b]) => a.record.evidence === "component_timestamps"
        && b.record.evidence === "component_timestamps" && documentedInputs(a.record) === documentedInputs(b.record))) };
  }

  function summarize(report, filters = {}) {
    const { kind = "archived", model, team, from, through, target = "final" } = filters;
    if (!kinds.includes(kind) || !targets.includes(target)) throw Error("Unsupported cohort or target");
    const games = new Map(report.games.filter(game => (!team || game.home === team || game.away === team)
      && (!from || game.date >= from) && (!through || game.date <= through)).map(game => [game.id, game]));
    const records = report.records.filter(row => row.kind === kind && (!model || row.model === model)
      && games.has(row.gameId));
    const observations = records.map(row => observation(row, games.get(row.gameId), target));
    const groups = Object.keys(models).filter(key => !model || key === model).map(key => {
      const rows = observations.filter(row => row.record.model === key);
      // Expected-goal targets and evidence levels must remain visible in aggregate.
      const cohorts = rows.length ? [...new Set(rows.map(row => row.record.goalTarget))] : ["playedGoals"];
      return { model: key, rows, metrics: cohorts.map(goalTarget => ({ goalTarget,
        evidence: [...new Set(rows.map(row => row.record.evidence))],
        ...metrics(rows.filter(row => row.record.goalTarget === goalTarget)) })) };
    });
    const comparisons = groups.flatMap((a, i) => groups.slice(i + 1)
      .map(b => ({ models: [a.model, b.model], ...compare(a.rows, b.rows) })));
    return { games: [...games.values()], records, groups: groups.map(({ model, metrics }) => ({ model, metrics })),
      comparisons };
  }

  const api = { models, kinds, buildReport, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BangerAccuracyLab = api;
})(globalThis);
