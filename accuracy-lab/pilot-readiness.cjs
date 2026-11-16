"use strict";

const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const { writeArchive } = require("./snapshot.cjs");
const { plan } = require("./pilot-automation.cjs");

const checks = [
  ["calendar", "PASS"],
  ["source-terms", "BLOCKED"],
  ["nhl-api", "PASS"],
  ["nhl-preview", "BLOCKED"],
  ["rotowire", "BLOCKED"],
  ["lineups-mirror", "WARNING"],
  ["archive-v26", "WARNING"],
  ["secrets", "BLOCKED"],
  ["workflow", "PASS"],
  ["settings", "BLOCKED"],
  ["signature", "PASS"],
  ["tsa", "BLOCKED"],
  ["archive-simulation", "PASS"],
  ["schedule", "WARNING"]
];

function build(simulationsPassed, testedAt) {
  const rows = [...checks, ["simulation", simulationsPassed ? "PASS" : "BLOCKED"]];
  return {
    schema: "banger-accuracy-security-report-v1", mode: "simulation", status: "BLOCKED",
    gameId: plan.gameId, referenceAt: plan.referenceAt, lastTest: testedAt, validPairs: 0,
    checks: rows.map(([id, status]) => ({ id, status }))
  };
}

if (require.main === module) {
  const output = process.argv[2];
  if (!output) throw Error("Usage: pilot-readiness.cjs REPORT.json");
  const simulation = spawnSync(process.execPath, ["--test", join(__dirname, "pilot-automation.test.cjs"),
    join(__dirname, "pilot-security.test.cjs")], { stdio: "inherit", timeout: 120000 });
  writeArchive(build(simulation.status === 0, new Date().toISOString()), output);
  if (simulation.status !== 0) process.exitCode = 1;
}

module.exports = { build };
