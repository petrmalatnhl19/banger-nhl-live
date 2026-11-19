"use strict";

const { execFileSync } = require("node:child_process");
const { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } = require("node:crypto");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { canonical, timestamp } = require("./engine.js");
const { inspectManifest, sha256 } = require("./reference.cjs");
const { writeArchive } = require("./snapshot.cjs");

const schema = "banger-accuracy-external-submission-v1";
const bytes = value => Buffer.from(canonical(value));
const domain = statement => Buffer.concat([Buffer.from("BANGER ACCURACY EXTERNAL TIME REQUEST\n"), bytes(statement)]);
const id = input => /^[a-f\d]{64}$/.test(input ?? "");
const sha = buffer => createHash("sha256").update(buffer).digest("hex");

function openssl(args) {
  return execFileSync("openssl", args, { timeout: 5000, maxBuffer: 64_000,
    stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH, LC_ALL: "C" } });
}

function requestFor(envelope) {
  const dir = mkdtempSync(join(tmpdir(), "banger-tsq-"));
  try {
    const data = join(dir, "snapshot.bin");
    const request = join(dir, "snapshot.tsq");
    writeFileSync(data, bytes(envelope), { mode: 0o600 });
    openssl(["ts", "-query", "-data", data, "-sha256", "-cert", "-out", request]);
    return readFileSync(request);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// RFC 3161 TimeStampReq: require SHA-256 imprint in the DER MessageImprint,
// an independently generated nonce, and a certificate request flag.
function checkRequest(request, expected) {
  let at = 0;
  function read(tag, limit = request.length) {
    if (request[at++] !== tag) throw Error("Invalid timestamp request tag");
    let length = request[at++];
    if (!Number.isInteger(length) || length >= 0x80 || at + length > limit) throw Error("Invalid timestamp request length");
    const end = at + length;
    return end;
  }
  const end = read(0x30);
  if (end !== request.length) throw Error("Invalid timestamp request boundary");
  if (read(0x02, end) !== at + 1 || request[at++] !== 1) throw Error("Invalid timestamp request version");
  const imprintEnd = read(0x30, end);
  const algorithmEnd = read(0x30, imprintEnd);
  const oidEnd = read(0x06, algorithmEnd);
  if (request.subarray(at, oidEnd).toString("hex") !== "608648016503040201") throw Error("Wrong timestamp algorithm");
  at = oidEnd;
  if (at < algorithmEnd && read(0x05, algorithmEnd) !== at) throw Error("Invalid SHA-256 parameters");
  if (at !== algorithmEnd) throw Error("Unexpected SHA-256 parameters");
  const digestEnd = read(0x04, imprintEnd);
  if (digestEnd !== imprintEnd || request.subarray(at, digestEnd).toString("hex") !== expected) {
    throw Error("Timestamp request does not match signed snapshot");
  }
  at = digestEnd;
  const nonceEnd = read(0x02, end);
  if (nonceEnd <= at || request.subarray(at, nonceEnd).every(value => value === 0)) throw Error("Missing timestamp request nonce");
  at = nonceEnd;
  if (read(0x01, end) !== at + 1 || request[at++] !== 255 || at !== end) throw Error("Unexpected timestamp request fields");
}

function prepareExport(manifest, privatePem, now = Date.now(), bindingSha256) {
  if (bindingSha256 !== undefined && !id(bindingSha256)) throw Error("Invalid linked archive digest");
  const inspection = inspectManifest(manifest, now);
  if (inspection.status === "rejected") throw Error("Snapshot export refused: " + inspection.reason);
  const privateKey = createPrivateKey(privatePem);
  if (privateKey.asymmetricKeyType !== "ed25519") throw Error("An Ed25519 signing key is required");
  const statement = { schema, purpose: "external_time_request", manifestSha256: sha256(manifest),
    ...(bindingSha256 !== undefined && { bindingSha256 }),
    localCreatedAt: new Date(now).toISOString(), nonce: randomBytes(32).toString("hex"),
    snapshotStatus: inspection.status === "verified" ? "structurally_complete" : "incomplete" };
  const envelope = { statement, manifest, publicKey: createPublicKey(privateKey).export({ type: "spki", format: "pem" }),
    signature: sign(null, domain(statement), privateKey).toString("base64") };
  const request = requestFor(envelope);
  const submission = { schema, envelope, request: request.toString("base64"), timeStatus: "unverified",
    independentlyVerified: false, eligibleForPairing: false };
  verifyExport(submission);
  return submission;
}

function verifyExport(submission) {
  const { envelope, request } = submission ?? {};
  const statement = envelope?.statement;
  if (submission?.schema !== schema || statement?.schema !== schema
    || statement.purpose !== "external_time_request" || !id(statement.nonce)
    || (Object.hasOwn(statement, "bindingSha256") && !id(statement.bindingSha256))
    || submission.timeStatus !== "unverified" || submission.independentlyVerified !== false
    || submission.eligibleForPairing !== false || statement.manifestSha256 !== sha256(envelope.manifest)
    || typeof envelope.signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)
    || typeof request !== "string" || request.length > 2048) throw Error("Invalid external time export");
  const key = createPublicKey(envelope.publicKey);
  if (key.asymmetricKeyType !== "ed25519" || !verify(null, domain(statement), key, Buffer.from(envelope.signature, "base64"))) {
    throw Error("Invalid local snapshot signature");
  }
  const manifest = inspectManifest(envelope.manifest, timestamp(statement.localCreatedAt));
  if (manifest.status === "rejected" || statement.snapshotStatus !== (manifest.status === "verified" ? "structurally_complete" : "incomplete")) {
    throw Error("Invalid signed manifest");
  }
  const signedSnapshotSha256 = sha(bytes(envelope));
  const requestBytes = Buffer.from(request, "base64");
  if (requestBytes.toString("base64") !== request) throw Error("Invalid timestamp request encoding");
  checkRequest(requestBytes, signedSnapshotSha256);
  return { manifestSha256: statement.manifestSha256, signedSnapshotSha256, referenceAt: manifest.referenceAt,
    missing: manifest.missing, timeStatus: "unverified", independentlyVerified: false, eligibleForPairing: false };
}

if (require.main === module) {
  try {
    const [command, input, keyOrOutput, output] = process.argv.slice(2);
    const json = JSON.parse(readFileSync(input, "utf8"));
    if (command === "prepare" && output) {
      writeArchive(prepareExport(json, readFileSync(keyOrOutput)), output);
    } else if (["verify", "status", "extract-tsq", "extract-envelope"].includes(command)) {
      const audit = verifyExport(json);
      if (command === "status") {
        writeArchive(require("./v26-replay.cjs").report({ ...audit, mode: "external_request" }), keyOrOutput);
      } else if (command !== "verify") writeFileSync(keyOrOutput,
        command === "extract-tsq" ? Buffer.from(json.request, "base64") : bytes(json.envelope), { flag: "wx", mode: 0o600 });
      else console.log(JSON.stringify(audit));
    } else {
      throw Error("Usage: external-time.cjs prepare MANIFEST PRIVATE_KEY OUTPUT | verify EXPORT | status|extract-tsq|extract-envelope EXPORT OUTPUT");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepareExport, verifyExport };
