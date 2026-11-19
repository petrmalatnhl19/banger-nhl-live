"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { test } = require("node:test");
const { buildArchive, replayArchive, compareResult } = require("./core43_cal38_experimental_capture.cjs");
const { fixture, signed, now } = require("./fixtures/core43_signed_export.cjs");

const match = { gameId: "2026020335", awayTeam: "EDM", homeTeam: "FLA",
  kickoffAt: "2026-11-09T23:00:00.000Z" };
const doc = () => fixture(now, { gameId: match.gameId, away: match.awayTeam, home: match.homeTeam });
const modelRevision = "a".repeat(40);
const inputs = (input = doc()) => {
  const { bytes, signature, trust } = signed(input);
  return { bytes, signature, now, modelRevision, profile: {
    mode: "simulation", source: trust.source, keyId: trust.keyId, match,
    publicKeyPem: trust.publicKey.export({ type: "spki", format: "pem" }),
  } };
};
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

test("CAL-38 archives all four variants and reproduces the exact signed-input calculation", () => {
  const input = inputs();
  const archiveBytes = buildArchive(input);
  const pin = digest(archiveBytes);
  const replayArgs = { archiveBytes, pin, profile: input.profile, modelRevision };
  const archive = replayArchive(replayArgs);
  assert.equal(archive.trusted, false);
  assert.equal(archive.mode, "simulation");
  assert.equal(archive.createdAt, now);
  assert.equal(archive.input.sha256, digest(input.bytes));
  assert.deepEqual(archive.variants.map(variant => variant.record.coefficient), [0, 0.005, 0.02, 0.03]);
  assert.deepEqual(archive.variants.map(variant => variant.sha256),
    archive.variants.map(variant => digest(Buffer.from(JSON.stringify(variant.record)))));
  assert.throws(() => replayArchive({ ...replayArgs, modelRevision: "b".repeat(40) }), /cal38_archive_revision/);
  archive.variants[0].record.away += 1;
  const changed = Buffer.from(JSON.stringify(archive));
  assert.throws(() => replayArchive({ ...replayArgs, archiveBytes: changed }), /cal38_archive_pin/);
  assert.throws(() => replayArchive({ ...replayArgs, archiveBytes: changed, pin: digest(changed) }),
    /cal38_replay_mismatch/);
});

test("CAL-38 rejects wrong matches, post-snapshot goalie data and delayed capture", () => {
  const input = inputs();
  assert.throws(() => buildArchive({ ...input, profile: {
    ...input.profile, match: { ...match, gameId: "2026020336" },
  } }), /cal38_match/);
  const futureRow = doc();
  futureRow.tables.goalieSnapshotRows[0].created_at = "2026-11-09T22:00:00.001Z";
  assert.throws(() => buildArchive(inputs(futureRow)), /cal07_goalie_snapshot/);
  assert.throws(() => buildArchive({ ...input, now: match.kickoffAt }), /cal07_freshness/);
  assert.throws(() => buildArchive({ ...input, signature: Buffer.alloc(64) }), /cal07_signature/);
});

test("CAL-38 compares a matching final without changing any frozen forecast", () => {
  const { profile, ...input } = inputs();
  const archiveBytes = buildArchive({ ...input, profile });
  const pin = digest(archiveBytes);
  const boxscore = { id: Number(match.gameId), startTimeUTC: match.kickoffAt.replace(".000Z", "Z"),
    gameState: "FINAL", gameOutcome: { lastPeriodType: "SO" },
    awayTeam: { abbrev: "EDM", score: 3 }, homeTeam: { abbrev: "FLA", score: 4 } };
  const args = { archiveBytes, pin, profile, modelRevision, boxscore };
  const comparison = compareResult(args);
  assert.equal(comparison.trusted, false);
  assert.equal(comparison.winner, "FLA");
  assert.equal(comparison.decidedIn, "SO");
  assert.deepEqual(comparison.score, { away: 3, home: 4 });
  assert.deepEqual(comparison.expectedGoals.map(({ coefficient, away, home }) => [coefficient, away, home]),
    JSON.parse(archiveBytes).variants.map(({ record }) => [record.coefficient, record.away, record.home]));
  assert.equal(digest(archiveBytes), pin);
  for (const change of [{ id: 2026020336 }, { gameState: "LIVE" }, { startTimeUTC: now }]) {
    assert.throws(() => compareResult({ ...args, boxscore: { ...boxscore, ...change } }), /cal38_final_match/);
  }
});
