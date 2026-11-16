"use strict";

const { createPrivateKey, createPublicKey, sign } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { checkPrivate, readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { MAX_BYTES, SCHEMA, planSignedExport, signatureMessage } = require("./core43_cal07_export.cjs");

function signSnapshot({ snapshot, profile, privateKey, now }) {
  if (!snapshot || Object.keys(snapshot).length !== 2 ||
      !Object.hasOwn(snapshot, "asOf") || !Object.hasOwn(snapshot, "tables")) {
    throw Error("cal39_snapshot");
  }
  const { mode, source, keyId, publicKeyPem, match } = profile ?? {};
  if (!["experimental", "simulation"].includes(mode) ||
      typeof match?.gameId !== "string" || !/^\d{10}$/.test(match.gameId) ||
      typeof publicKeyPem !== "string" || !publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") ||
      privateKey?.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") {
    throw Error("cal39_profile");
  }
  const publicKey = createPublicKey(publicKeyPem);
  if (!createPublicKey(privateKey).equals(publicKey)) throw Error("cal39_signing_key");

  const bytes = Buffer.from(JSON.stringify({
    schema: SCHEMA, source, keyId, gameId: match.gameId,
    asOf: snapshot.asOf, issuedAt: now, tables: snapshot.tables,
  }));
  if (bytes.length > MAX_BYTES) throw Error("cal07_size");
  const signature = sign(null, signatureMessage(bytes), privateKey);
  const { result, exportSha256 } = planSignedExport({
    bytes, signature, trust: { source, keyId, publicKey }, now, existing: [],
  });
  if (!result.ready) {
    const reason = /^[a-z0-9_]+$/.test(result.reason ?? "") ? result.reason : "incomplete_capture";
    throw Error("cal39_" + reason);
  }
  const record = result.variants[0].record;
  if (["awayTeam", "homeTeam", "kickoffAt"].some(field => record[field] !== match[field])) {
    throw Error("cal39_match");
  }
  return { bytes, signature, exportSha256, issuedAt: now };
}

function cli([snapshotPath, profilePath, signingKeyPath, outputDirectory, ...extra]) {
  if (!outputDirectory || extra.length) throw Error("cal39_usage");
  checkPrivate(signingKeyPath, false);
  const snapshot = JSON.parse(readBoundedFile(snapshotPath, MAX_BYTES));
  const profile = JSON.parse(readBoundedFile(profilePath, 16 * 1024));
  const privateKey = createPrivateKey(readBoundedFile(signingKeyPath, 16 * 1024));
  const { bytes, signature, exportSha256, issuedAt } = signSnapshot({
    snapshot, profile, privateKey, now: new Date().toISOString(),
  });
  mkdirSync(outputDirectory, { mode: 0o700 });
  const options = { flag: "wx", mode: 0o600 };
  writeFileSync(join(outputDirectory, "export.json"), bytes, options);
  writeFileSync(join(outputDirectory, "export.sig"), signature, options);
  return { exportSha256, issuedAt, mode: profile.mode, trusted: false };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(cli(process.argv.slice(2))));
  } catch (error) {
    console.error(/^cal(?:07|39)_[a-z0-9_]+$/.test(error.message) ? error.message : "cal39_invalid_input_or_output");
    process.exitCode = 1;
  }
}

module.exports = { signSnapshot };
