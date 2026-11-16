"use strict";
const { models, kinds, summarize, summarizeReference } = window.BangerAccuracyLab;
const modelIds = Object.keys(models);
const labels = { archived: "Archivovaná předzápasová predikce", reproduced: "Historicky reprodukovaná predikce",
  simulation: "Simulace" };
const goalsLabel = { playedGoals: "góly ze hry včetně prodloužení", regulation: "góly v základní době" };
const evidenceLabels = { component_timestamps: "Časy archivovaných komponent a součet ověřeny",
  archive_timestamp_only: "Čas archivace prošel kontrolou, jednotlivé vstupy nemají úplné časové doklady",
  simulation: "Simulace s neúplnými nebo nedoloženými vstupy" };
const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 3 });
const percent = new Intl.NumberFormat("cs-CZ", { style: "percent", maximumFractionDigits: 1 });
const fmt = (value, format = number) => Number.isFinite(value) ? format.format(value) : "—";
const fmtScore = score => fmt(score.away) + " : " + fmt(score.home);
const startTime = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "long", timeZone: "Europe/Prague" });
const el = id => document.getElementById(id);
const filters = el("filters");
let report;

function put(parent, tag, text) {
  const item = document.createElement(tag);
  if (text != null) item.textContent = text;
  parent.append(item);
  return item;
}

function replaceTable(parent, columns, rows) {
  parent.replaceChildren();
  const table = put(parent, "table");
  const header = put(put(table, "thead"), "tr");
  for (const column of columns) put(header, "th", column).scope = "col";
  const body = put(table, "tbody");
  for (const values of rows) {
    const row = put(body, "tr");
    for (const value of values) put(row, "td", value);
  }
}

function showModels(groups) {
  const holder = el("models");
  holder.replaceChildren();
  for (const group of groups) {
    const item = put(holder, "article");
    put(item, "h3", models[group.model].label);
    put(item, "p", models[group.model].availability);
    for (const stats of group.metrics) {
      put(item, "p", stats.n + " vyhodnocených zápasů");
      if (!stats.n) continue;
      const interval = stats.accuracy95?.map(x => fmt(x, percent)).join(" až ");
      put(item, "p", "Úspěšnost " + fmt(stats.accuracy, percent) + " · " + stats.correct + "/" + stats.calls
        + (interval ? " · 95% interval " + interval : ""));
      put(item, "p", "MAE " + fmt(stats.mae) + " · hosté " + fmt(stats.awayMAE) + " · domácí " + fmt(stats.homeMAE)
        + " · " + goalsLabel[stats.goalTarget]);
      put(item, "p", stats.evidence.map(key => evidenceLabels[key] ?? key).join(" · "));
      put(item, "p", "Brier " + fmt(stats.brier) + " · log loss " + fmt(stats.logLoss) + " · n = " + stats.probabilityN);
      if (stats.calibration.length) {
        const bins = put(item, "details");
        put(bins, "summary", "Kalibrace výhry domácích");
        replaceTable(put(bins, "div"), ["Pásmo", "n", "Odhad", "Skutečnost", "95% interval"],
          stats.calibration.map(bin => [fmt(bin.from, percent) + "–" + fmt(bin.to, percent), String(bin.n),
            fmt(bin.predicted, percent), fmt(bin.observed, percent), bin.observed95.map(x => fmt(x, percent)).join("–")]));
      } else {
        put(item, "small", "Bez doložených pravděpodobností pro zvolený výsledek.");
      }
    }
  }
}

function showComparisons(data) {
  if (!data.length) {
    el("pairs").replaceChildren();
    put(el("pairs"), "p", "Vyber všechny modely pro párové porovnání.");
    return;
  }
  const rows = data.filter(pair => pair.sameGames.n).map(pair => [
    pair.models.map(key => models[key].label).join(" / "), String(pair.sameGames.n),
    String(pair.sameInstant.n), String(pair.sameSnapshot.n),
    pair.sameGames.mae.map(x => fmt(x)).join(" / ") + " (n = " + pair.sameGames.goalsN + ")",
    pair.sameGames.accuracy.map(x => fmt(x, percent)).join(" / ") + " (n = " + pair.sameGames.callsN + ")"
  ]);
  if (rows.length) {
    replaceTable(el("pairs"), ["Modely", "Stejné zápasy", "Stejný čas", "Stejné doložené vstupy a čas", "MAE", "Úspěšnost"], rows);
  } else {
    el("pairs").replaceChildren();
    put(el("pairs"), "p", "Pro vybrané období a původ nejsou žádné společné predikce.");
  }
}

function showHistory(data, kind, model) {
  const list = el("history");
  list.replaceChildren();
  const byId = new Map();
  for (const record of data.records) {
    if (!byId.has(record.gameId)) byId.set(record.gameId, []);
    byId.get(record.gameId).push(record);
  }
  const visible = data.games.filter(game => (kind === "archived" && !model) || byId.has(game.id));
  if (!visible.length) put(list, "p", "Pro zvolené filtry nejsou žádné záznamy.");
  for (const game of visible) {
    const item = put(list, "details");
    const forecasts = byId.get(game.id) ?? [];
    put(item, "summary", game.date + " · " + game.away + " – " + game.home + " · " + fmtScore(game.final)
      + " · " + ({ REG: "Základní doba", OT: "Prodloužení", SO: "Nájezdy" })[game.ending]);
    put(item, "p", "NHL " + game.id + " · " + startTime.format(new Date(game.scheduledAt))
      + " (plán) · 60 minut " + fmtScore(game.regulation) + " · góly ze hry " + fmtScore(game.playedGoals));
    put(item, "p", "Oficiální začátek " + (game.actualStartAt ? startTime.format(new Date(game.actualStartAt))
      + " (přesnost na minuty)" : "nedoložen"));
    const goalies = ["away", "home"].map(side => (game.postgameGoalies?.[side]?.participants ?? [])
      .map(g => g.name || g.playerId).join(", ") || "—");
    put(item, "p", "Skuteční brankáři · " + goalies.join(" / "));
    const source = put(item, "a", "Oficiální NHL boxscore");
    source.href = "https://www.nhl.com/gamecenter/" + game.id + "/boxscore";
    if (!forecasts.length) put(item, "p", "V tomto výběru chybí archivovaná predikce.");
    for (const row of forecasts) {
      put(item, "p", models[row.model].label + " · " + labels[row.kind] + " · "
        + fmtScore(row.goals) + " · " + startTime.format(new Date(row.asOf)));
      if (row.probability) {
        put(item, "p", (row.probability.target === "final" ? "Výhra včetně prodloužení a nájezdů" : "Po 60 minutách")
          + " · hosté " + fmt(row.probability.values.away, percent) + " · domácí " + fmt(row.probability.values.home, percent)
          + (row.probability.target === "regulation" ? " · remíza " + fmt(row.probability.values.draw, percent) : ""));
      }
      put(item, "small", evidenceLabels[row.evidence] ?? row.evidence);
      for (const player of Object.values(row.goalieStatus ?? {}).filter(Boolean)) {
        put(item, "p", "Předzápasový zdroj · " + (player.name ?? "—") + " · " + (player.status ?? "neznámý stav"));
      }
      if (row.inputs.length) {
        const inputs = put(item, "details");
        put(inputs, "summary", "Doložené vstupy");
        for (const input of row.inputs) put(inputs, "p", input.name + " · " + (input.availableAt || "čas nedoložen")
          + " · " + (input.source || "zdroj nedoložen"));
      }
    }
  }
}

const inputLabels = { schedule: "Rozpis", teamStats: "Statistiky týmů", lineups: "Sestavy",
  goalies: "Brankáři", homeAdvantage: "Domácí výhoda", rest: "Odpočinek a únava", absences: "Absence" };
const verificationLabels = { verified: "Čas ověřen", incomplete: "Čas ověřen · chybí vstupy",
  missing: "Bez snímku", rejected: "Odmítnut" };
const referenceReasons = { conflicting_snapshot: "Rozporné snímky", invalid_snapshot: "Neplatný formát snímku",
  wrong_reference_time: "Neshoda T−60", untrusted_snapshot_receipt: "Nedůvěryhodný podpis",
  snapshot_after_reference: "Potvrzení po T−60", invalid_observation: "Neplatný vstup nebo otisk",
  invalid_observation_time: "Vstup nelze doložit před T−60",
  official_schedule_or_start_mismatch: "Neshoda s plánem nebo skutečným začátkem NHL" };

function showReference(options) {
  const context = el("reference-context");
  const modelsBox = el("reference-models");
  const pairs = el("reference-pairs");
  const detail = el("reference-detail");
  const table = el("reference-coverage");
  modelsBox.replaceChildren();
  pairs.replaceChildren();
  table.replaceChildren();
  const partition = el("reference-partition").value;
  const view = summarizeReference(report, { ...options, partition });
  el("reference-filter").hidden = !view;
  detail.hidden = !view?.coverage.length;
  if (!view) {
    context.textContent = "Tento report vznikl před zavedením T−60. Pro časové ověření vytvoř nový report.";
    return;
  }
  const { policy, validationOpen, models: availability, required } = report.reference;
  if (partition === "validation" && validationOpen) {
    context.textContent = "Výsledky validačního období jsou uzamčené do " + startTime.format(new Date(policy.validationEndExclusive)) + ".";
  } else {
    context.textContent = labels[options.kind] + " · " + view.comparablePredictions + " srovnatelných predikcí na "
      + view.comparableGames + " zápasech · " + view.coverage.filter(row => row.status === "verified").length + "/"
      + view.coverage.length + " úplných časově ověřených snímků.";
  }
  for (const group of view.groups) {
    const id = group.model;
    const item = put(modelsBox, "article");
    put(item, "h3", models[id].label);
    const count = view.records.filter(row => row.model === id).length;
    put(item, "p", count + " predikcí v této kategorii");
    const mode = availability[id].replay;
    put(item, "small", mode === "simulation_only" ? "Místně dostupná pouze simulace citlivosti GSAx."
      : "Přesná místní reprodukce nedostupná. Lze ověřit podepsaný archiv.");
  }
  if (view.paired.length) {
    replaceTable(pairs, ["Pár modelů", "Zápasy", "MAE na tým", "Úspěšnost"], view.paired.map(pair => {
      const stats = pair.sameSnapshot;
      return [pair.models.map(id => models[id].label).join(" / "), String(stats.n),
        stats.mae.map(x => fmt(x)).join(" / "), stats.accuracy.map(x => fmt(x, percent)).join(" / ")];
    }));
  } else {
    put(pairs, "p", "V tomto výběru není platný pár se stejným snímkem T−60.");
  }
  if (view.coverage.length) {
    const absent = required.map(key => [key, view.coverage.filter(row => row.missing.includes(key)).length])
      .filter(([, count]) => count);
    if (absent.length) put(table, "p", absent.map(([key, count]) => inputLabels[key] + " " + count).join(" · "));
    replaceTable(put(table, "div"), ["NHL Game ID", "Čas T−60", "Stav", "Chybějící vstupy"],
      view.coverage.map(row => [row.gameId, startTime.format(new Date(row.referenceAt)), [
        verificationLabels[row.status], referenceReasons[row.reason], inputLabels[row.input]].filter(Boolean).join(" · "),
      row.missing.map(key => inputLabels[key]).join(", ") || "—"]));
  }
}

function render() {
  const options = Object.fromEntries(new FormData(filters));
  const pilotIds = report.reference && new Set(report.reference.coverage.filter(row => row.partition === "pilot").map(row => row.gameId));
  const history = pilotIds ? { ...report, games: report.games.filter(game => pilotIds.has(game.id)) } : report;
  const data = summarize(history, options);
  showReference(options);
  el("context").textContent = labels[options.kind] + " · " + new Set(data.records.map(row => row.gameId)).size
    + " zápasů s predikcí ve výběru. "
    + (options.target === "final" ? "U archivovaných výstupů je tip odvozen z vyššího odhadu gólů."
      : "Tip po 60 minutách vyžaduje predikci tohoto výsledku.");
  showModels(data.groups);
  showComparisons(data.comparisons);
  showHistory(data, options.kind, options.model);
}
filters.addEventListener("change", render);
el("reference-partition").addEventListener("change", render);
el("load").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 20_000_000) throw Error("report too large");
    const candidate = JSON.parse(await file.text());
    if (candidate?.schema !== "banger-core-accuracy-01" || !Array.isArray(candidate.games)
      || !Array.isArray(candidate.records) || !candidate.games.every(game => /^\d{10}$/.test(game.id))
      || !candidate.records.every(row => modelIds.includes(row.model) && kinds.includes(row.kind))) {
      throw Error("invalid report");
    }
    report = candidate;
    filters.reset();
    el("reference-partition").value = "pilot";
    const team = filters.elements.team;
    team.replaceChildren(new Option("Všechny týmy", ""));
    const teams = [...new Set(report.games.flatMap(game => [game.away, game.home]))].sort();
    for (const value of teams) team.add(new Option(value, value));
    render();
    filters.hidden = false;
    el("report").hidden = false;
    el("status").textContent = report.games.length + " výsledků NHL v reportu · "
      + report.scope.end + " a předchozí dny.";
  } catch {
    report = null;
    filters.hidden = true;
    el("report").hidden = true;
    el("status").textContent = "Soubor se nepodařilo načíst. Vyber JSON vytvořený evaluátorem CORE Accuracy Lab.";
  } finally {
    event.target.value = "";
  }
});
for (const [id, model] of Object.entries(models)) filters.elements.model.add(new Option(model.label, id));
