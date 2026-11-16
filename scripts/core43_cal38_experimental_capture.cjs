"use strict";

const { execFileSync } = require("node:child_process");
const { createHash, createPublicKey } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { WINDOW } = require("./core43_cal03_capture_plan.cjs");
const { MAX_BYTES, planSignedExport } = require("./core43_cal07_export.cjs");
const { readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { finalOutcome } = require("./core43_cal11_evaluate.cjs");

const SCHEMA = "core43_cal38_experimental_capture_v1";
const SHA256 = /^[a-f0-9]{64}$/;
const modes = ["experimental", "simulation"];
const matchFields = ["gameId", "awayTeam", "homeTeam", "kickoffAt"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = value => Buffer.from(JSON.stringify(value));

function buildArchive({ bytes, signature, profile, now, modelRevision }) {
  if (!modes.includes(profile?.mode) || !/^[a-f0-9]{40}$/.test(modelRevision)) {
    throw Error("cal38_profile");
  }
  const { mode, source, keyId, publicKeyPem, match } = profile;
  if (typeof publicKeyPem !== "string" || !publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----")) {
    throw Error("cal38_profile");
  }
  const trust = { source, keyId, publicKey: createPublicKey(publicKeyPem) };
  const { result, exportSha256 } = planSignedExport({ bytes, signature, trust, now, existing: [] });
  if (!result.ready) throw Error("cal38_incomplete_capture");

  const first = result.variants[0].record;
  if (!match || !/^\d{10}$/.test(first.gameId) || matchFields.some(field => first[field] !== match[field])) {
    throw Error("cal38_match");
  }

  return encode({
    schema: SCHEMA, mode, trusted: false, modelRevision, createdAt: now,
    match: Object.fromEntries(matchFields.map(field => [field, first[field]])),
    input: { source, keyId, sha256: exportSha256, bytes: bytes.toString("base64url"),
      signature: signature.toString("base64url") },
    variants: result.variants.map(({ record, sha256 }) => ({ record, sha256 })),
  });
}

function replayArchive({ archiveBytes, pin, profile, modelRevision }) {
  if (typeof pin !== "string" || !SHA256.test(pin) || sha256(archiveBytes) !== pin) {
    throw Error("cal38_archive_pin");
  }
  const saved = JSON.parse(archiveBytes);
  if (saved.schema !== SCHEMA || saved.modelRevision !== modelRevision) throw Error("cal38_archive_revision");
  const regenerated = buildArchive({
    bytes: Buffer.from(saved.input.bytes, "base64url"),
    signature: Buffer.from(saved.input.signature, "base64url"),
    profile, now: saved.createdAt, modelRevision,
  });
  if (!regenerated.equals(archiveBytes)) throw Error("cal38_replay_mismatch");
  return saved;
}

function compareResult({ archiveBytes, pin, profile, modelRevision, boxscore }) {
  const saved = replayArchive({ archiveBytes, pin, profile, modelRevision });
  const { gameId, awayTeam, homeTeam, kickoffAt } = saved.match;
  if (String(boxscore?.id) !== gameId) throw Error("cal38_final_match");
  const result = finalOutcome({ origin: "recomputed", boxscore,
    sourceUrl: "https://api-web.nhle.com/v1/gamecenter/" + gameId + "/boxscore" }, "recomputed");
  if (!result || result.awayTeam !== awayTeam || result.homeTeam !== homeTeam || result.kickoff !== kickoffAt) {
    throw Error("cal38_final_match");
  }
  return {
    gameId, mode: saved.mode, trusted: false, archiveSha256: pin,
    score: { away: boxscore.awayTeam.score, home: boxscore.homeTeam.score },
    decidedIn: boxscore.gameOutcome.lastPeriodType,
    winner: result.homeWin ? homeTeam : awayTeam,
    expectedGoals: saved.variants.map(({ record }) => ({
      coefficient: record.coefficient, away: record.away, home: record.home,
      pick: record.away === record.home ? null : record.home > record.away ? homeTeam : awayTeam,
    })),
  };
}

function cleanRevision() {
  const root = resolve(__dirname, "..");
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  if (git(["status", "--porcelain", "--untracked-files=all"])) throw Error("cal38_dirty_checkout");
  return git(["rev-parse", "HEAD"]);
}

function cli([command, ...args]) {
  if (args.length !== 4 || !["capture", "compare"].includes(command)) throw Error("cal38_usage");
  const modelRevision = cleanRevision();
  const [inputPath, signatureOrPin, profilePath, outputOrBoxscore] = args;
  const profile = JSON.parse(readBoundedFile(profilePath, 16 * 1024));
  if (command === "capture") {
    const bytes = readBoundedFile(inputPath, MAX_BYTES);
    const signature = readBoundedFile(signatureOrPin, 64);
    const archive = buildArchive({ bytes, signature, profile, modelRevision, now: new Date().toISOString() });
    if (Date.now() > Date.parse(profile.match.kickoffAt) - WINDOW.minMinutes * 60_000) {
      throw Error("cal38_window_closed");
    }
    writeFileSync(outputOrBoxscore, archive, { flag: "wx", mode: 0o600 });
    return { archiveSha256: sha256(archive), mode: profile.mode, trusted: false };
  }
  return compareResult({
    archiveBytes: readBoundedFile(inputPath, 128 * 1024), pin: signatureOrPin, profile, modelRevision,
    boxscore: JSON.parse(readBoundedFile(outputOrBoxscore, 2 * 1024 * 1024)),
  });
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(cli(process.argv.slice(2))));
  } catch (error) {
    console.error(/^cal(?:07|38)_[a-z_]+$/.test(error.message) ? error.message : "cal38_invalid_input");
    process.exitCode = 1;
  }
}

module.exports = { buildArchive, replayArchive, compareResult };
