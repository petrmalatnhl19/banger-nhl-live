"use strict";
// CAL-18B offline immutable-evidence package. No network or database access.
const { createHash } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync, lstatSync, openSync, fstatSync, closeSync, constants } = require("node:fs");
const { join, resolve, basename } = require("node:path");
const { verifyTimestamp } = require("./core43_cal16_timestamp.cjs");
const { validateConfig } = require("./core43_cal18_verify.cjs");
const sha = b => createHash("sha256").update(b).digest("hex");
const names = ["bundle.bin", "request.tsq", "response.tsr", "tsa-ca.pem"];
function loadInputs(files) {
  const profile = validateConfig(JSON.parse(readFileSync(files.profile, "utf8")));
  const bytes = [files.bundle, files.request, files.response, profile.caFile].map(p => readFileSync(p));
  return { profile, bytes };
}
function verifiedManifest(profile, bytes) {
  const result = verifyTimestamp({
    packageBytes: bytes[0], request: bytes[1], response: bytes[2],
    authority: { kind: profile.kind, policyOid: profile.policyOid,
      signerFingerprint256: profile.signerFingerprint256,
      maxAccuracyMs: profile.maxAccuracyMs, caPem: bytes[3] },
  });
  return {
    schema: "core43_cal18b_evidence_v1", verification: "timestamp_signature_only",
    independentOperationProven: false, officialGameStartVerified: false,
    packageDigest: result.digest, latestAt: new Date(result.latestMs).toISOString(),
    authority: { kind: profile.kind, policyOid: profile.policyOid,
      signerFingerprint256: profile.signerFingerprint256,
      maxAccuracyMs: profile.maxAccuracyMs },
    files: Object.fromEntries(names.map((n, i) => [n, { sha256: sha(bytes[i]), bytes: bytes[i].length }])),
  };
}
function archiveEvidence(destination, files) {
  const { profile, bytes } = loadInputs(files);
  const manifest = verifiedManifest(profile, bytes);
  const parent = resolve(destination);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const target = join(parent, manifest.packageDigest);
  const temp = mkdtempSync(join(parent, ".cal18b-"));
  try {
    names.forEach((n, i) => writeFileSync(join(temp, n), bytes[i], { flag: "wx", mode: 0o600 }));
    writeFileSync(join(temp, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n",
      { flag: "wx", mode: 0o600 });
    // Fail closed on a pre-existing archive: never overwrite, including duplicate requests.
    try { lstatSync(target); throw Error("cal18b_already_archived"); }
    catch (e) { if (e.code !== "ENOENT") throw e; }
    renameSync(temp, target);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  return { directory: target, manifest };
}
// CAL-28K: verify each opened inode, not a pathname checked before opening.
function readArchiveFile(directory, name) {
  const file = join(directory, name);
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0);
  const fd = openSync(file, flags);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.nlink !== 1)
      throw Error("cal28k_unsafe_open_file:" + name);
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    if (!after.isFile() || after.nlink !== 1 ||
        before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs)
      throw Error("cal28k_file_changed_during_read:" + name);
    return bytes;
  } finally { closeSync(fd); }
}
function verifyArchive(directory) {
  const archiveDir = lstatSync(directory);
  if (!archiveDir.isDirectory() || archiveDir.isSymbolicLink())
    throw Error("cal28j_unsafe_archive_directory");
  const manifest = JSON.parse(readArchiveFile(directory, "manifest.json").toString("utf8"));
  if (manifest.schema !== "core43_cal18b_evidence_v1" ||
      manifest.verification !== "timestamp_signature_only" ||
      manifest.independentOperationProven !== false ||
      manifest.officialGameStartVerified !== false ||
      !/^[a-f0-9]{64}$/.test(manifest.packageDigest) ||
      basename(resolve(directory)) !== manifest.packageDigest) throw Error("cal18b_manifest");
  const bytes = names.map(n => {
    const b = readArchiveFile(directory, n);
    if (sha(b) !== manifest.files?.[n]?.sha256 || b.length !== manifest.files[n].bytes)
      throw Error("cal18b_tampered_archive");
    return b;
  });
  const profile = { ...manifest.authority, caFile: join(directory, "tsa-ca.pem") };
  validateConfig(profile);
  const verified = verifiedManifest(profile, bytes);
  if (JSON.stringify(verified) !== JSON.stringify(manifest)) throw Error("cal18b_manifest_mismatch");
  return verified;
}

if (require.main === module) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "archive" && args.length === 5) {
      const [dest, bundle, request, response, profile] = args;
      console.log(JSON.stringify(archiveEvidence(dest, { bundle, request, response, profile }), null, 2));
    } else if (command === "verify" && args.length === 1) {
      console.log(JSON.stringify(verifyArchive(args[0]), null, 2));
    } else throw Error("cal18b_usage: archive DIR BUNDLE TSQ TSR PROFILE | verify ARCHIVE_DIR");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { archiveEvidence, verifyArchive };
