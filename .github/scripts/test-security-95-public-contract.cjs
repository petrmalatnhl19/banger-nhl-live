"use strict";
const assert = require("node:assert/strict");
const { FIELDS, MAX_ROWS, publishTvRows } = require("../../security/local/security95-public-contract.cjs");

const input = {
  archive: [
    { game_id: 1, status: "pending", private_archive: "SECRET" },
    { game_id: 2, status: "final" }
  ],
  predictions: [
    { game_id: 1, core42_away: 2.25, core42_home: 3.25, core43_away: 1.25,
      core43_home: 2.5, experiment_status: "internal", private_goalie: "SECRET" },
    { game_id: 2, core43_away: 9 }
  ],
  previews: [
    { game_id: 1, core43_preview_away: 2.75, core43_preview_home: 3.5,
      away_gsax_per100: 1.5, home_gsax_per100: 2.25, preview_status: "internal",
      source_snapshot: "SECRET" }
  ]
};
const result = publishTvRows(input);
assert.equal(result.length, 1);
assert.deepEqual(Object.keys(result[0]), FIELDS);
assert.deepEqual(result[0], {
  game_id: 1, core42_away: 2.25, core42_home: 3.25,
  core43_away: 1.25, core43_home: 2.5,
  core43_preview_away: 2.75, core43_preview_home: 3.5,
  away_gsax_per100: 1.5, home_gsax_per100: 2.25
});
assert(!JSON.stringify(result).includes("SECRET"));
assert.equal(publishTvRows({ ...input, previews: [] })[0].away_gsax_per100, null);
assert.equal(publishTvRows({ ...input, predictions: [{ game_id: 1, core43_away: Infinity }] })[0].core43_away, null);
assert.throws(() => publishTvRows({ archive: null, predictions: [], previews: [] }), TypeError);
const many = Array.from({ length: MAX_ROWS + 5 }, (_, i) => ({ game_id: i + 10, status: "pending" }));
assert.equal(publishTvRows({ archive: many, predictions: [], previews: [] }).length, MAX_ROWS);
console.log("PASS SECURITY-95 offline public contract: allowlist, pending filter, bounded rows, finite values");
