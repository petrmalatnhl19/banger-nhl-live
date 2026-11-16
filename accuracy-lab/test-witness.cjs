"use strict";

const { readFileSync } = require("node:fs");
const { createPublicKey, generateKeyPairSync, sign, verify } = require("node:crypto");
const { canonical, timestamp } = require("./engine.js");
const { prepare } = require("./pregame.cjs");
const { inspectPlayers, status } = require("./players.cjs");
const { inspectManifest, sha256, required } = require("./reference.cjs");
const { writeArchive } = require("./snapshot.cjs");

const schema = "banger-accuracy-test-receipt-v1";
const domain = statement => Buffer.from("BANGER ACCURACY LAB TEST ONLY\n" + canonical(statement));

function inspectRequest(request, observedAt) {
  if (request?.schema !== "banger-accuracy-test-request-v1" || request.players?.captureSha256 !== sha256(request.capture)
    || canonical(request.players.sources?.score) !== canonical(request.capture.sources?.score)) {
    throw Error("Test request must bind the same NHL score and capture bytes");
  }
  const players = inspectPlayers(request.players);
  const manifest = prepare(request.capture, request.review, timestamp(request.players.finishedAt));
  if (players.game.id !== manifest.gameId || players.game.teams.away.team !== manifest.away
    || players.game.teams.home.team !== manifest.home || players.game.scheduledAt !== manifest.scheduledAt) {
    throw Error("Players and manifest game mismatch");
  }
  const seen = timestamp(observedAt);
  if (!Number.isFinite(seen) || seen < timestamp(request.players.finishedAt) || seen > timestamp(manifest.referenceAt)) {
    throw Error("Test clock is outside the original observation window");
  }
  for (const group of ["lineups", "absences"]) {
    if (!players.timely || players.missing.includes(group)) continue;
    const payload = Object.fromEntries(["away", "home"].map(side => [side, players.records
      .filter(row => row.group === group && row.team === players.game.teams[side].team).map(row => row.playerId)]));
    const { awayRoster, homeRoster } = request.players.sources;
    const preview = request.players.sources[players.previewKey];
    const retrievedAt = new Date(Math.max(...[preview, awayRoster, homeRoster].map(source => timestamp(source.retrievedAt)))).toISOString();
    manifest.observations[group] = { source: preview.url, dataThrough: players.article.modifiedAt,
      availableAt: retrievedAt, retrievedAt, payload, sha256: sha256(payload) };
  }
  // The factor is optionally supplied as versioned configuration for testing, never inferred from team names.
  if (request.homeAdvantage) manifest.observations.homeAdvantage = request.homeAdvantage;
  const checked = inspectManifest(manifest, seen);
  if (checked.status === "rejected") throw Error(checked.reason + (checked.input ? ": " + checked.input : ""));
  return { manifest: { ...manifest, schema: "banger-accuracy-test-manifest-v1" },
    missing: required.filter(key => checked.missing.includes(key)), playerCaptureTimely: players.timely };
}

function issueTest(request, at = Date.now()) {
  const observedAt = new Date(at).toISOString();
  const result = inspectRequest(request, observedAt);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const statement = { schema, mode: "internal_test", observedAt, requestSha256: sha256(request),
    manifestSha256: sha256(result.manifest) };
  return { statement, publicKey: publicKey.export({ type: "spki", format: "pem" }),
    signature: sign(null, domain(statement), privateKey).toString("base64") };
}

function verifyTest(request, receipt) {
  const statement = receipt?.statement;
  if (statement?.schema !== schema || statement.mode !== "internal_test" || statement.requestSha256 !== sha256(request)
    || typeof receipt.signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signature)) throw Error("Invalid test receipt");
  const key = createPublicKey(receipt.publicKey);
  if (key.asymmetricKeyType !== "ed25519" || !verify(null, domain(statement), key, Buffer.from(receipt.signature, "base64"))) {
    throw Error("Invalid test signature");
  }
  const result = inspectRequest(request, statement.observedAt);
  if (statement.manifestSha256 !== sha256(result.manifest)) throw Error("Test receipt does not match manifest");
  return { ...result, mode: "internal_test", independentlyVerified: false, eligibleForPairing: false };
}

if (require.main === module) {
  const [command, requestPath, first, second] = process.argv.slice(2);
  try {
    const read = file => JSON.parse(readFileSync(file, "utf8"));
    const request = read(requestPath);
    if (command === "issue-test" && first && !second) {
      writeArchive(issueTest(request), first);
    } else if (command === "verify-test" && first && second) {
      const result = verifyTest(request, read(first));
      const report = status(request.players);
      report.games[0].stage = "internal_test";
      report.games[0].missing = result.missing;
      writeArchive(report, second);
      console.log(JSON.stringify({ missing: result.missing, independentlyVerified: false, eligibleForPairing: false }));
    } else {
      throw Error("Usage: test-witness.cjs issue-test REQUEST RECEIPT | verify-test REQUEST RECEIPT STATUS");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { issueTest, verifyTest };
