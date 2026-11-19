"use strict";
// CAL-28N: independent adversarial process, synthetic test data only.
const { existsSync, writeFileSync, renameSync, cpSync } = require("node:fs");
const { join } = require("node:path");
const [mode, target, control] = process.argv.slice(2);
if (!["tamper", "swap"].includes(mode) || !target || !control) process.exit(2);
writeFileSync(join(control, "ready"), "ready");
const started = Date.now();
const poll = setInterval(() => {
  if (!existsSync(join(control, "go"))) {
    if (Date.now() - started > 12000) { clearInterval(poll); process.exit(3); }
    return;
  }
  clearInterval(poll);
  try {
    if (mode === "tamper") writeFileSync(target, "CAL28N concurrent mutation");
    else {
      renameSync(target, target + ".old");
      cpSync(target + ".old", target, { recursive: true });
    }
    writeFileSync(join(control, "ack"), "done");
  } catch (e) {
    writeFileSync(join(control, "error"), e.message);
    process.exitCode = 4;
  }
}, 5);
