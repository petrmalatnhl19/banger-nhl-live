"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { join } = require("node:path");
const { mkdirSync, existsSync, readFileSync, writeFileSync } = require("node:fs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pause = new Int32Array(new SharedArrayBuffer(4));
async function waitFor(file, child, timeout = 12000) {
  const start = Date.now();
  while (!existsSync(file)) {
    if (child.exitCode !== null) throw Error("cal28n_worker_exited:" + child.exitCode);
    if (Date.now() - start > timeout) throw Error("cal28n_worker_timeout:" + file);
    await sleep(10);
  }
}
for (const mode of ["tamper", "swap"]) {
  test("CAL-28N independent process " + mode + " fails closed", async t => {
    const { dir, pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
    const control = join(dir, "control-" + mode);
    mkdirSync(control);
    const target = mode === "tamper" ? join(archived.directory, "bundle.bin") : archived.directory;
    const child = spawn(process.execPath, [join(__dirname, "fixtures/core43_cal28_concurrent_worker.cjs"),
      mode, target, control], { stdio: "ignore" });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    await waitFor(join(control, "ready"), child);
    assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
      archiveRoot: archives,
      onStage(stage) {
        if (stage !== "temp_fsynced") return;
        writeFileSync(join(control, "go"), "go");
        const start = Date.now();
        while (!existsSync(join(control, "ack"))) {
          if (existsSync(join(control, "error")))
            throw Error("cal28n_worker_error:" + readFileSync(join(control, "error"), "utf8"));
          if (Date.now() - start > 12000) throw Error("cal28n_worker_ack_timeout");
          Atomics.wait(pause, 0, 0, 10);
        }
      },
    }), /cal28b_invalid_archive:1|cal28m_archive_directory_identity_changed/);
    assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
    assert.equal(existsSync(pin + ".lock"), false);
    assert.equal(existsSync(pin + ".next-" + process.pid), false);
  });
}
