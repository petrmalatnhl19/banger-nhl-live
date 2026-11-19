"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createPublicKey, generateKeyPairSync } = require("node:crypto");
const { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { fixture, now } = require("./fixtures/core43_signed_export.cjs");
const { buildArchive } = require("./core43_cal38_experimental_capture.cjs");
const { signSnapshot } = require("./core43_cal39_sign_snapshot.cjs");

function example(asOf = now) {
  const { privateKey } = generateKeyPairSync("ed25519");
  const gameId = "2026020335";
  const awayTeam = "EDM";
  const homeTeam = "FLA";
  const { source, keyId, tables } = fixture(asOf, { gameId, away: awayTeam, home: homeTeam });
  const profile = {
    mode: "simulation", source, keyId,
    publicKeyPem: createPublicKey(privateKey).export({ type: "spki", format: "pem" }),
    match: { gameId, awayTeam, homeTeam, kickoffAt: tables.schedules[0].kickoff_at },
  };
  return { snapshot: { asOf, tables }, profile, privateKey, now: asOf };
}

test("CAL-39 output is accepted by CAL-38 and retains exact source bytes and timestamp", () => {
  const args = example();
  const before = JSON.stringify(args.snapshot);
  const { bytes, signature, exportSha256 } = signSnapshot(args);
  const archive = JSON.parse(buildArchive({
    bytes, signature, profile: args.profile, now, modelRevision: "a".repeat(40),
  }));
  assert.equal(archive.trusted, false);
  assert.equal(archive.variants.length, 4);
  assert.equal(archive.input.sha256, exportSha256);
  assert.equal(JSON.parse(bytes).asOf, args.snapshot.asOf);
  assert.equal(JSON.parse(bytes).issuedAt, now);
  assert.equal(JSON.stringify(args.snapshot), before);
});

test("CAL-39 rejects later inputs, missing coverage, invalid key, wrong kickoff and stale snapshots", () => {
  const args = example();
  const delayed = example();
  delayed.snapshot.tables.observations[0].observed_at = new Date(Date.parse(now) + 1).toISOString();
  assert.throws(() => signSnapshot(delayed), /cal07_observation/);

  const incomplete = example();
  incomplete.snapshot.tables.observations.pop();
  assert.throws(() => signSnapshot(incomplete), /cal39_variant_0_home_missing_pregame_observation/);

  const mismatched = example();
  mismatched.profile.match.kickoffAt = now;
  assert.throws(() => signSnapshot(mismatched), /cal39_match/);
  assert.throws(() => signSnapshot({ ...args, privateKey: mismatched.privateKey }), /cal39_signing_key/);
  assert.throws(() => signSnapshot({ ...args, now: new Date(Date.parse(now) + 300_001).toISOString() }), /cal07_freshness/);
});

test("CAL-39 CLI produces a private pair and never overwrites an existing export directory", t => {
  const dir = mkdtempSync(join(tmpdir(), "core43-cal39-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { snapshot, profile, privateKey } = example(new Date().toISOString());
  const snapshotPath = join(dir, "snapshot.json");
  const profilePath = join(dir, "profile.json");
  const keyPath = join(dir, "signing.pem");
  const output = join(dir, "export");
  writeFileSync(snapshotPath, JSON.stringify(snapshot));
  writeFileSync(profilePath, JSON.stringify(profile));
  writeFileSync(keyPath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  const cli = () => spawnSync(process.execPath, [
    join(__dirname, "core43_cal39_sign_snapshot.cjs"), snapshotPath, profilePath, keyPath, output,
  ], { encoding: "utf8" });

  const run = cli();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).mode, "simulation");
  assert.equal(JSON.parse(run.stdout).trusted, false);
  assert.equal(statSync(output).mode & 0o077, 0);
  const exportPath = join(output, "export.json");
  const sigPath = join(output, "export.sig");
  const bytes = readFileSync(exportPath);
  const signature = readFileSync(sigPath);
  assert.equal(statSync(exportPath).mode & 0o077, 0);
  assert.equal(statSync(sigPath).mode & 0o077, 0);
  assert.equal(signature.length, 64);
  assert.equal(cli().status, 1);
  assert.deepEqual(readFileSync(exportPath), bytes);
  assert.deepEqual(readFileSync(sigPath), signature);
});
