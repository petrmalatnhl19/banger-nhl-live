"use strict";

// SECURITY-95: offline-only publication contract prototype.
// No network calls, credentials, database access, or production integration.
const FIELDS = Object.freeze([
  "game_id", "core42_away", "core42_home", "core43_away", "core43_home",
  "core43_preview_away", "core43_preview_home", "away_gsax_per100", "home_gsax_per100"
]);
const NUMERIC = FIELDS.filter(name => name !== "game_id");
const MAX_ROWS = 40;

function finiteOrNull(value) {
  if (value === null || typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function publishTvRows({ archive, predictions, previews }) {
  if (![archive, predictions, previews].every(Array.isArray)) throw new TypeError("arrays required");
  const seen = new Set();
  const pending = [];
  for (const row of archive) {
    if (!row || row.status !== "pending" || !Number.isSafeInteger(row.game_id) || row.game_id <= 0 || seen.has(row.game_id)) continue;
    seen.add(row.game_id);
    pending.push(row);
    if (pending.length === MAX_ROWS) break;
  }
  const unique = (rows) => {
    const map = new Map();
    for (const row of rows) {
      if (!row || !Number.isSafeInteger(row.game_id) || row.game_id <= 0 || map.has(row.game_id)) continue;
      map.set(row.game_id, row);
    }
    return map;
  };
  const p = unique(predictions), v = unique(previews);
  return pending.filter(row => Number.isSafeInteger(row.game_id)).map(row => {
    const prediction = p.get(row.game_id) || {};
    const preview = v.get(row.game_id) || {};
    const output = { game_id: row.game_id };
    for (const name of NUMERIC) {
      const source = name.startsWith("core43_preview_") || name.endsWith("_gsax_per100")
        ? preview : prediction;
      output[name] = finiteOrNull(source[name]);
    }
    return output;
  });
}
module.exports = { FIELDS, MAX_ROWS, publishTvRows };
