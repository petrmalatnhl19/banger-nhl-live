"use strict";

const { execFile } = require("node:child_process");
const { join } = require("node:path");
const { promisify } = require("node:util");
const { now } = require("./core43_signed_export.cjs");

const exec = promisify(execFile);

const childProgram = `
  const { receiveAcrossRuns } = require(process.argv[1]);
  const { createPrivateKey, createPublicKey } = require("node:crypto");
  const { existsSync, readFileSync, writeFileSync } = require("node:fs");
  const config = JSON.parse(readFileSync(0, "utf8"));
  const shared = new Int32Array(new SharedArrayBuffer(4));
  let firstCall = true;
  const clock = () => {
    if (firstCall && config.marker) {
      firstCall = false;
      writeFileSync(config.marker, "");
      const until = Date.now() + 5000;
      while (!existsSync(config.peer)) {
        if (Date.now() > until) throw Error("fixture barrier timed out");
        Atomics.wait(shared, 0, 0, 10);
      }
    }
    if (config.stop === "before") process.exit(91);
    return config.now;
  };
  const outcome = receiveAcrossRuns({ ...config, clock,
    privateKey: createPrivateKey(config.privateKey),
    trust: { ...config.trust, publicKey: createPublicKey(config.trust.publicKey) },
    exportTrust: { ...config.exportTrust, publicKey: createPublicKey(config.exportTrust.publicKey) }
  });
  if (config.stop === "after") process.exit(92);
  console.log(JSON.stringify(outcome));
`;

function runLedgerWorker(options, extras = {}) {
  const { trust, privateKey, exportTrust } = options;
  const pem = publicKey => publicKey.export({ type: "spki", format: "pem" });
  const config = { ...options, now, ...extras,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    trust: { ...trust, publicKey: pem(trust.publicKey) },
    exportTrust: { ...exportTrust, publicKey: pem(exportTrust.publicKey) },
  };
  const run = exec(process.execPath, ["--experimental-sqlite", "-e", childProgram,
    join(__dirname, "..", "core43_cal09_ledger_transfer.cjs")]);
  run.child.stdin.end(JSON.stringify(config));
  return run;
}

module.exports = { runLedgerWorker };
