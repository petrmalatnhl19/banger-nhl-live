"use strict";
const fs = require("node:fs");
const { buildReport, summarize, summarizeReference, kinds } = require("./engine.js");
const { buildReference } = require("./reference.cjs");

function run(input, output, reference = {}, trust = {}) {
  const report = buildReport(JSON.parse(fs.readFileSync(input, "utf8")));
  report.reference = buildReference(report.games, reference, trust);
  const pilotIds = new Set(report.reference.coverage.filter(row => row.partition === "pilot").map(row => row.gameId));
  report.records = report.records.filter(row => pilotIds.has(row.gameId));
  const pilot = { games: report.games.filter(game => pilotIds.has(game.id)), records: report.records };
  const summaries = Object.fromEntries(kinds.map(kind => [kind, {
    final: summarize(pilot, { kind, target: "final" }),
    regulation: summarize(pilot, { kind, target: "regulation" })
  }]));
  const audit = { selected: report.scope.selectedIds.length, normalizedOutcomes: report.games.length,
    byReason: {}, byModel: {} };
  audit.reference = Object.fromEntries(["pilot", "validation"].map(partition => {
    const view = summarizeReference(report, { partition });
    return [partition, { comparableGames: view.comparableGames, comparablePredictions: view.comparablePredictions,
      assessedGames: view.coverage.length, verifiedSnapshots: view.coverage.filter(row => row.status === "verified").length }];
  }));
  for (const issue of report.issues) {
    audit.byReason[issue.reason] = (audit.byReason[issue.reason] ?? 0) + 1;
    if (issue.model) {
      const counts = audit.byModel[issue.model] ??= {};
      counts[issue.reason] = (counts[issue.reason] ?? 0) + 1;
    }
  }
  for (const cohort of Object.values(summaries)) {
    for (const view of Object.values(cohort)) {
      delete view.games;
      delete view.records;
    }
  }
  fs.writeFileSync(output, JSON.stringify({ ...report, summaries, audit }) + "\n", { flag: "wx" });
  return audit;
}

if (require.main === module) {
  try {
    const [input, output, bundle, trust] = process.argv.slice(2);
    if (![4, 6].includes(process.argv.length)) {
      throw Error("Usage: node accuracy-lab/evaluate.cjs INPUT.json OUTPUT.json [REFERENCE.json TRUST.json]");
    }
    const read = file => file ? JSON.parse(fs.readFileSync(file, "utf8")) : undefined;
    console.log(JSON.stringify(run(input, output, read(bundle), read(trust)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { run };
