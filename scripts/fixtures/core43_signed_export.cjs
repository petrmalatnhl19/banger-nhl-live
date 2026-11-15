"use strict";

const { generateKeyPairSync, sign } = require("node:crypto");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const trust = { publicKey, source: "banger-test-only", keyId: "fixture-v1" };
const at = time => `2026-11-09T${time}:00.000Z`;
const now = at("22:00");
const schema = "core43_cal07_pregame_export_v1";

function fixture(asOf = now) {
  const relative = minutes => new Date(Date.parse(asOf) + minutes * 60_000).toISOString();
  const game = { game_id: "42", away_team: "DAL", home_team: "NYR" };
  const goalies = [["DAL", "Goalie A", "8471234"], ["NYR", "Goalie B", "8475678"]];
  return {
    schema, source: trust.source, keyId: trust.keyId, gameId: game.game_id, asOf, issuedAt: asOf,
    tables: {
      schedules: [{ ...game, kickoff_at: relative(60), fetched_at: relative(-120) }],
      predictions: [{ ...game, core42_predicted_at: relative(-600), core42_away: 3, core42_home: 2.8 }],
      observations: goalies.map(([team_code, goalie_name]) => ({
        game_id: game.game_id, team_code, goalie_name, observed_status: "projected",
        observed_at: relative(-480), source_snapshot_at: relative(-540),
      })),
      identities: goalies.map(([team_code, goalie_name, goalie_id]) => ({
        team_code, goalie_name, goalie_id, observed_at: relative(-600),
      })),
      goalieSnapshotRows: goalies.map(([team_code, , goalie_id]) => ({
        team_code, goalie_id, situation: "all", fetched_at: relative(-30), created_at: relative(-29),
        source_sha256: "a".repeat(64), x_goals_against: 52, goals_against: 49, shots_against: 600,
      })),
    },
  };
}

function signed(doc = fixture(), key = privateKey) {
  const bytes = Buffer.isBuffer(doc) ? doc : Buffer.from(JSON.stringify(doc));
  const signature = sign(null, Buffer.concat([Buffer.from(schema + "\0"), bytes]), key);
  return { bytes, signature, now, trust, existing: [] };
}

module.exports = { at, now, fixture, signed };
