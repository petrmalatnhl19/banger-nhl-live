"use strict";

const { linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { canonical } = require("./engine.js");
const { inspectSnapshot, sha256 } = require("./reference.cjs");

function freeze(input, trust, output) {
  const result = inspectSnapshot(input, trust.snapshot);
  if (result.status === "rejected") throw Error(result.reason + (result.input ? ": " + result.input : ""));
  // Preserve the witness envelope alongside the exact canonical JSON payloads.
  const temp = mkdtempSync(join(dirname(output), ".accuracy-snapshot-"));
  try {
    const file = join(temp, "snapshot.json");
    writeFileSync(file, canonical(input) + "\n", { flag: "wx", mode: 0o600, flush: true });
    linkSync(file, output);
  } finally {
    rmSync(temp, { recursive: true });
  }
  return result;
}

if (require.main === module) {
  try {
    const [command, input, second, output] = process.argv.slice(2);
    const read = path => JSON.parse(readFileSync(path, "utf8"));
    if (command === "digest" && process.argv.length === 4) {
      console.log(sha256(read(input)));
    } else if (command === "signing-bytes" && process.argv.length === 5) {
      writeFileSync(second, canonical(read(input)), { flag: "wx", mode: 0o600 });
    } else if (command === "freeze" && process.argv.length === 6) {
      console.log(JSON.stringify(freeze(read(input), read(second), output), null, 2));
    } else {
      throw Error("Usage: snapshot.cjs digest INPUT | signing-bytes INPUT OUTPUT | freeze ENVELOPE TRUST OUTPUT");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { freeze };
