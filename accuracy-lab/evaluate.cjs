"use strict";
const fs = require("node:fs");
const { buildReport, summarize, kinds } = require("./engine.js");

function run(input, output) {
  const report = buildReport(JSON.parse(fs.readFileSync(input, "utf8")));
  const summaries = Object.fromEntries(kinds.map(kind => [kind, {
    final: summarize(report, { kind, target: "final" }),
    regulation: summarize(report, { kind, target: "regulation" })
  }]));
  const audit = { selected: report.scope.selectedIds.length, normalizedOutcomes: report.games.length,
    byReason: {}, byModel: {} };
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
    if (process.argv.length !== 4) throw Error("Usage: node accuracy-lab/evaluate.cjs INPUT.json OUTPUT.json");
    console.log(JSON.stringify(run(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { run };
