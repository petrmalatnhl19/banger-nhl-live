"use strict";
// Crash-rehearsal harness: synthetic digest only; never touches live archives.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, existsSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { GENESIS, recoverLedger, readLedger, appendArchive } = require("./core43_cal19_chain.cjs");
const DIGEST = "a".repeat(64);
for (const stage of ["lock_acquired", "temp_fsynced", "ledger_renamed", "directory_fsynced"]) {
  test("CAL-20 crash at " + stage + " fails closed and preserves ledger", t => {
    const dir = mkdtempSync(join(tmpdir(), "cal20-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const ledger = join(dir, "ledger.jsonl");
    const script = `
      const { appendArchive } = require(${JSON.stringify(require.resolve("./core43_cal19_chain.cjs"))});
      appendArchive(process.argv[1], "synthetic-only", ${JSON.stringify(GENESIS)}, {
        verifyArchive: () => ({packageDigest: ${JSON.stringify(DIGEST)}}),
        onStage: stage => { if (stage === process.argv[2]) process.exit(77); },
      });
      process.exit(0);
    `;
    const result = spawnSync(process.execPath, ["-e", script, ledger, stage], { encoding: "utf8" });
    assert.equal(result.status, 77, result.stderr);
    assert.equal(existsSync(ledger + ".lock"), true, "crashed writer lock must persist");
    const state = recoverLedger(ledger, GENESIS);
    if (stage === "lock_acquired" || stage === "temp_fsynced") {
      assert.equal(state.status, "consistent");
      assert.equal(state.count, 0);
    } else {
      assert.equal(state.status, "unconfirmed_append");
      assert.equal(state.count, 1);
      assert.equal(readLedger(ledger)[0].archiveDigest, DIGEST);
    }
    assert.throws(() => appendArchive(ledger, "missing", GENESIS), /cal19_writer_locked/);
  });
}
test("CAL-20 rejects tampered ledger after simulated crash", t => {
  const dir = mkdtempSync(join(tmpdir(), "cal20-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ledger = join(dir, "ledger.jsonl");
  const script = `
    const { appendArchive } = require(${JSON.stringify(require.resolve("./core43_cal19_chain.cjs"))});
    appendArchive(process.argv[1], "synthetic", ${JSON.stringify(GENESIS)}, {
      verifyArchive: () => ({packageDigest: ${JSON.stringify(DIGEST)}}),
      onStage: stage => { if (stage === "ledger_renamed") process.exit(77); },
    });
  `;
  assert.equal(spawnSync(process.execPath, ["-e", script, ledger]).status, 77);
  const fs = require("node:fs");
  fs.writeFileSync(ledger, readFileSync(ledger, "utf8").replace(DIGEST, "b".repeat(64)));
  assert.throws(() => recoverLedger(ledger, GENESIS), /cal19_chain_invalid/);
});
