"use strict";
// SECURITY-96: adversarial offline contract tests. Not a database/RLS/API authorization test.
const assert = require("node:assert/strict");
const { publishTvRows, FIELDS, MAX_ROWS } = require("../../security/local/security95-public-contract.cjs");
const fixture = {
  archive: [
    null, { game_id: -1, status: "pending" }, { game_id: "1", status: "pending" },
    { game_id: 1, status: "final" }, { game_id: 1, status: "pending", secret: "private" },
    { game_id: 1, status: "pending" }, { game_id: 2, status: "pending" }
  ],
  predictions: [
    { game_id: 1, core43_away: 1.5, core43_home: 2.5, core42_away: 2, core42_home: 3,
      experiment_status: "not-approved", secret: "private" },
    { game_id: 2, core43_away: Infinity, core43_home: "2.3" },
    { game_id: 2, core43_away: 99 }
  ],
  previews: [
    { game_id: 1, core43_preview_away: 3, core43_preview_home: 4,
      away_gsax_per100: 1, home_gsax_per100: 2, preview_status: "not-approved",
      secret: "private" },
    { game_id: 2, away_gsax_per100: NaN, home_gsax_per100: -1 }
  ]
};
const snapshot = JSON.stringify(fixture);
for (const role of ["anon", "authenticated"]) {
  // Role labels exercise identical public payload expectations only; no JWT/SQL role switch occurs.
  const output = publishTvRows(fixture);
  assert.deepEqual(output.map(x => x.game_id), [1, 2], role);
  assert.deepEqual(Object.keys(output[0]), FIELDS, role);
  assert.equal(output[0].core43_away, 1.5);
  assert.equal(output[1].core43_away, null);
  assert.equal(output[1].core43_home, null);
  assert.equal(output[1].away_gsax_per100, null);
  assert.equal(output[1].home_gsax_per100, -1);
  assert(!JSON.stringify(output).includes("private"));
  assert(!JSON.stringify(output).includes("not-approved"));
}
assert.equal(JSON.stringify(fixture), snapshot, "input objects must not be mutated");
const bad = [{ game_id: 0, status: "pending" }, { game_id: Number.MAX_SAFE_INTEGER + 1, status: "pending" }];
assert.deepEqual(publishTvRows({ archive: bad, predictions: [], previews: [] }), []);
const many = Array.from({ length: MAX_ROWS + 3 }, (_, i) => ({ game_id: i + 1, status: "pending" }));
assert.equal(publishTvRows({ archive: many, predictions: [], previews: [] }).length, MAX_ROWS);
assert.throws(() => publishTvRows({ archive: [], predictions: {}, previews: [] }), TypeError);
console.log("PASS SECURITY-96 adversarial offline contract; SQL roles and gateway remain untested");
