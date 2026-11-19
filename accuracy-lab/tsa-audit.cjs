"use strict";

const { execFileSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { verifyExport } = require("./external-time.cjs");
const { timestamp } = require("./engine.js");

function openssl(args) {
  return execFileSync("openssl", args, { timeout: 5000, maxBuffer: 128_000,
    stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH, LC_ALL: "C", TZ: "UTC" } }).toString();
}

function accuracyBound(line) {
  if (!/^0x[\da-f]+ seconds, 0x[\da-f]+ millis, 0x[\da-f]+ micros$/i.test(line ?? "")) return null;
  const [s, ms, us] = line.match(/0x[\da-f]+/gi).map(Number);
  return [s, ms, us].every(Number.isSafeInteger) && ms <= 999 && us <= 999 && s <= 86400
    ? s * 1000 + ms + Math.ceil(us / 1000) : null;
}

function auditReceipt({ request, response, ca, signer, crl, digest, cutoff }) {
  const report = { technicalValid: false, status: "BLOCKED", independentlyVerified: false,
    genTime: null, accuracyMs: null, revocation: "unverified", issues: ["authority_not_approved"] };
  const end = timestamp(cutoff);
  const dir = mkdtempSync(join(tmpdir(), "banger-tsa-audit-"));
  try {
    if (!/^[a-f0-9]{64}$/.test(digest ?? "") || !Number.isFinite(end)) throw Error();
    function save(name, bytes) {
      if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 512_000) throw Error();
      const file = join(dir, name);
      writeFileSync(file, bytes, { mode: 0o600 });
      return file;
    }
    const rsp = save("receipt.tsr", response);
    const req = save("request.tsq", request);
    const root = save("ca.pem", ca);
    const leaf = save("signer.pem", signer);
    const actual = join(dir, "actual.pem");
    const token = join(dir, "token.der");
    const details = openssl(["ts", "-reply", "-in", rsp, "-text"]);
    const genTime = /^Time stamp: (.+ GMT)$/m.exec(details)?.[1];
    const ms = Date.parse(genTime);
    if (!/^Status: Granted\.$/m.test(details) || !/^Hash Algorithm: sha256$/m.test(details)
      || !/^Nonce: 0x[0-9A-F]+$/im.test(details) || !Number.isFinite(ms)) throw Error();
    const attime = String(Math.floor(ms / 1000));
    const verify = ["ts", "-verify", "-in", rsp, "-CAfile", root,
      "-untrusted", leaf, "-attime", attime];
    openssl([...verify, "-queryfile", req]);
    openssl([...verify, "-digest", digest]);
    openssl(["ts", "-reply", "-in", rsp, "-token_out", "-out", token]);
    openssl(["cms", "-verify", "-binary", "-inform", "DER", "-in", token, "-certfile", leaf,
      "-noverify", "-signer", actual, "-out", join(dir, "content")]);
    const [pem] = readFileSync(actual, "utf8").trim().split("-----END CERTIFICATE-----");
    const actualPem = pem + "-----END CERTIFICATE-----";
    if (readFileSync(actual, "utf8").split("-----BEGIN CERTIFICATE-----").length !== 2
      || new X509Certificate(actualPem).fingerprint256 !== new X509Certificate(signer).fingerprint256) throw Error();
    report.technicalValid = true;
    report.genTime = new Date(ms).toISOString();
    report.accuracyMs = accuracyBound(/^Accuracy: (.+)$/m.exec(details)?.[1]);
    if (report.accuracyMs === null) report.issues.push("accuracy_not_declared");
    if (ms + (report.accuracyMs ?? 0) > end) report.issues.push("outside_cutoff");
    if (crl) {
      try {
        const list = save("revocations.pem", crl);
        openssl(["verify", "-CAfile", root, "-CRLfile", list,
          "-crl_check", "-attime", attime, leaf]);
        report.revocation = "checked_against_supplied_crl_at_gen_time";
      } catch {
        report.issues.push("revocation_check_failed");
      }
    } else report.issues.push("revocation_not_checked");
  } catch {
    report.issues.push("invalid_receipt_or_verification_material");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return report;
}

function read(file) {
  if (statSync(file).size > 512_000) throw Error();
  return readFileSync(file);
}

if (require.main === module) {
  try {
    const [exportFile, response, ca, signer, crl] = process.argv.slice(2);
    const submission = JSON.parse(read(exportFile));
    const audit = verifyExport(submission);
    const report = auditReceipt({ request: Buffer.from(submission.request, "base64"), response: read(response),
      ca: read(ca), signer: read(signer), crl: crl && read(crl), digest: audit.signedSnapshotSha256, cutoff: audit.referenceAt });
    console.log(JSON.stringify(report, null, 2));
    if (!report.technicalValid) process.exitCode = 1;
  } catch {
    console.error("Timestamp audit failed. Check the signed export and trust files.");
    process.exitCode = 1;
  }
}

module.exports = { auditReceipt, accuracyBound };
