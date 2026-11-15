"use strict";

const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync } = require("node:crypto");
const { test } = require("node:test");
const { planSignedExport } = require("./core43_cal07_export.cjs");

const { at, fixture, signed } = require("./fixtures/core43_signed_export.cjs");

test("verified bytes feed the existing offline planner and reuse its deduplication keys", () => {
  const input = signed();
  const first = planSignedExport(input);
  assert.equal(first.exportSha256, createHash("sha256").update(input.bytes).digest("hex"));
  assert.equal(first.result.ready, true, first.result.reason);
  assert.equal(first.result.writeEnabled, false);
  assert.equal(first.result.uniqueVariants, 4);
  assert.deepEqual(first.result.variants.map(x => x.record.coefficient), [0, 0.005, 0.02, 0.03]);
  assert.equal(first.result.variants[0].record.away, 3);
  assert.equal(first.result.variants[0].record.home, 2.8);
  const existing = first.result.variants.map(x => x.key);

  const retry = planSignedExport({ ...input, existing });
  assert.equal(retry.result.uniqueVariants, 0);
  const reissued = fixture();
  reissued.issuedAt = at("22:01");
  const again = planSignedExport({ ...signed(reissued), now: at("22:01"), existing });
  assert.notEqual(again.exportSha256, first.exportSha256);
  assert.equal(again.result.uniqueVariants, 0);

  const rescheduled = fixture();
  rescheduled.tables.schedules[0].kickoff_at = at("23:10");
  assert.equal(planSignedExport({ ...signed(rescheduled), existing }).result.uniqueVariants, 4);
});

test("tampering, an untrusted signer, malformed UTF-8 and ambiguous JSON fail closed", () => {
  const input = signed();
  const tampered = Buffer.from(input.bytes);
  tampered[tampered.length - 2] ^= 1;
  assert.throws(() => planSignedExport({ ...input, bytes: tampered }), /cal07_signature/);
  assert.throws(() => planSignedExport(signed(fixture(), generateKeyPairSync("ed25519").privateKey)), /cal07_signature/);
  assert.throws(() => planSignedExport({ ...input, signature: Buffer.alloc(65) }), /cal07_size/);
  assert.throws(() => planSignedExport(signed(Buffer.alloc(65 * 1024))), /cal07_size/);
  assert.throws(() => planSignedExport(signed(Buffer.from([0xff]))), /cal07_encoding/);
  const duplicateKey = input.bytes.toString().replace('"gameId":"42"', '"gameId":"41","gameId":"42"');
  assert.throws(() => planSignedExport(signed(Buffer.from(duplicateKey))), /cal07_manifest/);
});

const cases = [
  ["different project claim", doc => { doc.source = "other-project"; }, "manifest"],
  ["wrong key ID", doc => { doc.keyId = "other-key"; }, "manifest"],
  ["future signer timestamp", doc => { doc.issuedAt = at("22:01"); }, "freshness"],
  ["stale snapshot", doc => { doc.asOf = at("21:54"); }, "freshness"],
  ["archive row from another game", doc => { doc.tables.predictions[0].game_id = "43"; }, "prediction"],
  ["unrequested table", doc => { doc.tables.users = []; }, "tables"],
  ["unrequested field", doc => { doc.tables.predictions[0].actual_away = 5; }, "columns"],
  ["duplicate row", doc => { doc.tables.observations.push({ ...doc.tables.observations[0] }); }, "duplicate_row"],
  ["schedule outside window", doc => { doc.tables.schedules[0].kickoff_at = at("23:16"); }, "schedule"],
  ["baseline newer than snapshot", doc => { doc.tables.predictions[0].core42_predicted_at = at("22:01"); }, "prediction"],
  ["observation from another team", doc => { doc.tables.observations[0].team_code = "BOS"; }, "observation"],
  ["future observation source", doc => { doc.tables.observations[0].source_snapshot_at = at("22:01"); }, "observation"],
  ["goalie record from another team", doc => { doc.tables.identities[0].team_code = "BOS"; }, "identity"],
  ["goalie snapshot created after cutoff", doc => { doc.tables.goalieSnapshotRows[0].created_at = at("22:01"); }, "goalie_snapshot"],
  ["conflicting goalie row for same snapshot", doc => {
    doc.tables.goalieSnapshotRows.push({ ...doc.tables.goalieSnapshotRows[0], goals_against: 50 });
  }, "ambiguous_snapshot"],
  ["mixed upstream snapshots", doc => { doc.tables.goalieSnapshotRows[0].source_sha256 = "b".repeat(64); }, "ambiguous_snapshot"],
];

for (const [label, mutate, error] of cases) {
  test("rejects " + label, () => {
    const doc = fixture();
    mutate(doc);
    assert.throws(() => planSignedExport(signed(doc)), { message: "cal07_" + error });
  });
}

test("delay past the pregame window and missing goalie evidence stop calculation", () => {
  const doc = fixture();
  doc.tables.schedules[0].kickoff_at = at("22:45");
  assert.throws(() => planSignedExport({ ...signed(doc), now: at("22:01") }), /cal07_window/);
  doc.tables.goalieSnapshotRows = [];
  const { result } = planSignedExport(signed(doc));
  assert.equal(result.ready, false);
  assert.equal(result.reason, "missing_archived_pregame_gsax");
});

test("missing or malformed prior keys block the offline consumer", () => {
  const input = signed();
  assert.throws(() => planSignedExport({ ...input, existing: undefined }), /cal07_ledger/);
  assert.throws(() => planSignedExport({ ...input, existing: [42] }), /cal07_ledger/);
});
