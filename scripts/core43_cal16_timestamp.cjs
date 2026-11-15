"use strict";

const { execFileSync } = require("node:child_process");
const { createHash, X509Certificate } = require("node:crypto");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { acceptPackage, MAX_PACKAGE_BYTES } = require("./core43_cal13_coordinator.cjs");
const { finalOutcome } = require("./core43_cal11_evaluate.cjs");

const OID = /^\d+(?:\.\d+){2,}$/;
const PIN = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function requireValid(condition, reason) {
  if (!condition) throw Error("cal16_" + reason);
}

function bounded(buf, max) {
  return Buffer.isBuffer(buf) && buf.length > 0 && buf.length <= max;
}

function openssl(args, reason) {
  try {
    return execFileSync("openssl", args, {
      encoding: "utf8", timeout: 5000, maxBuffer: 512 * 1024,
      env: { PATH: process.env.PATH, LC_ALL: "C" }, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw Error("cal16_" + reason);
  }
}

function signedTimeFields(text, maxAccuracyMs) {
  const stamp = /^Time stamp: ([A-Za-z]{3}) +(\d{1,2}) (\d\d:\d\d:\d\d)(?:\.(\d{1,9}))? (\d{4}) GMT$/m.exec(text);
  const accuracy = /^Accuracy: (0x[0-9a-f]+|unspecified) seconds, (0x[0-9a-f]+|unspecified) millis, (0x[0-9a-f]+|unspecified) micros$/mi.exec(text);
  requireValid(stamp && accuracy && accuracy.slice(1).some(value => value !== "unspecified"), "time_fields");
  const [, month, day, clock, fraction = "", year] = stamp;
  const monthNumber = MONTHS.indexOf(month) + 1;
  const wholeIso = `${year}-${String(monthNumber).padStart(2, "0")}-${day.padStart(2, "0")}T${clock}.000Z`;
  const whole = Date.parse(wholeIso);
  requireValid(monthNumber && Number.isFinite(whole) && new Date(whole).toISOString() === wholeIso, "time_fields");

  const [seconds, millis, micros] = accuracy.slice(1).map(x => x === "unspecified" ? 0 : Number(x));
  const uncertainty = seconds * 1000 + millis + micros / 1000;
  requireValid(millis <= 999 && micros <= 999 && uncertainty <= maxAccuracyMs, "accuracy");
  // Round the signed interval outwards before comparing it to external deadlines.
  const fractionalMs = Number((fraction + "000000000").slice(0, 9)) / 1_000_000;
  const earliestMs = whole + Math.floor(fractionalMs) - Math.ceil(uncertainty);
  const latestMs = whole + Math.ceil(fractionalMs) + Math.ceil(uncertainty);
  return { whole, earliestMs, latestMs };
}

function verifyTimestamp({ packageBytes, request, response, authority }) {
  requireValid(bounded(packageBytes, MAX_PACKAGE_BYTES) && bounded(request, 4096) &&
    bounded(response, 128 * 1024) && bounded(authority?.caPem, 64 * 1024), "size");
  requireValid(typeof authority.policyOid === "string" && OID.test(authority.policyOid) &&
    typeof authority.signerFingerprint256 === "string" && PIN.test(authority.signerFingerprint256) &&
    Number.isSafeInteger(authority.maxAccuracyMs) && authority.maxAccuracyMs >= 0 &&
    ["test", "independent"].includes(authority.kind), "trust");
  const digest = sha256(packageBytes);
  const dir = mkdtempSync(join(tmpdir(), "cal16-"));
  try {
    const queryPath = join(dir, "request.tsq"), responsePath = join(dir, "response.tsr");
    const caPath = join(dir, "authority.pem"), tokenPath = join(dir, "token.der");
    const signerPath = join(dir, "signer.pem"), infoPath = join(dir, "info.der");
    for (const [path, bytes] of [[queryPath, request], [responsePath, response], [caPath, authority.caPem]]) {
      writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
    }
    const queryInfo = openssl(["ts", "-query", "-in", queryPath, "-text"], "request");
    requireValid(/^Hash Algorithm: sha256$/m.test(queryInfo) && /^Nonce: 0x(?!0+$)[0-9A-F]+$/im.test(queryInfo),
      "query_profile");

    const info = openssl(["ts", "-reply", "-in", responsePath, "-text"], "response");
    requireValid(/^Status: Granted\.$/m.test(info) && /^Hash Algorithm: sha256$/m.test(info) &&
      /^Policy OID: (\S+)$/m.exec(info)?.[1] === authority.policyOid, "response_profile");
    // Parsing can happen before verification. No parsed field is trusted or returned until verification succeeds.
    const { whole, earliestMs, latestMs } = signedTimeFields(info, authority.maxAccuracyMs);
    const base = ["ts", "-verify", "-CAfile", caPath, "-in", responsePath, "-attime", String(whole / 1000)];
    openssl([...base, "-queryfile", queryPath], "signature_or_nonce");
    openssl([...base, "-digest", digest], "package_binding");

    openssl(["ts", "-reply", "-in", responsePath, "-token_out", "-out", tokenPath], "token");
    // The chain and timestamp-signing purpose were already checked by ts -verify.
    // This second CMS check extracts the certificate that actually signed the token.
    openssl(["cms", "-verify", "-binary", "-inform", "DER", "-in", tokenPath, "-noverify",
      "-signer", signerPath, "-out", infoPath], "signer");
    const signers = readFileSync(signerPath, "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
    requireValid(signers.length === 1 &&
      new X509Certificate(signers[0]).fingerprint256 === authority.signerFingerprint256, "signer_pin");
    return { digest, earliestMs, latestMs };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function acceptTimestampedPackage(path, options, trust) {
  requireValid((trust?.origin === "simulation" && options?.authority?.kind === "test") ||
    (trust?.origin === "historical" && options?.authority?.kind === "independent"), "authority_origin");
  const { digest, latestMs } = verifyTimestamp(options);
  const { capture, receipt } = JSON.parse(options.packageBytes.toString("utf8"));
  const prediction = capture?.prediction;

  // The normalized NHL evidence is obtained independently of the package.
  const actual = finalOutcome(options.outcome, trust.origin);
  requireValid(options.outcome?.officialStart && actual && prediction?.origin === trust.origin &&
    String(options.outcome.boxscore.id) === prediction.gameId && actual.kickoff === prediction.kickoffAt &&
    actual.awayTeam === prediction.awayTeam && actual.homeTeam === prediction.homeTeam, "outcome");
  const observedAt = Date.parse(receipt?.statement?.observedAt);
  requireValid(Number.isFinite(observedAt) && observedAt <= latestMs, "witness_order");
  requireValid(latestMs < Date.parse(actual.kickoff) && latestMs < Date.parse(actual.startedAt), "late_timestamp");

  // CAL-13 re-verifies the signed export, witness, policy and full four-variant capture before writing.
  const result = acceptPackage(path, options.packageBytes, trust);
  return { ...result, timestamp: { digest, latestAt: new Date(latestMs).toISOString(), authority: options.authority.kind } };
}

module.exports = { verifyTimestamp, acceptTimestampedPackage };
