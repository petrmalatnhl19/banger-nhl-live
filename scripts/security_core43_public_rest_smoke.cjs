"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

async function main() {
  // Public browser configuration only. Never use a service_role or secret key.
  const frontend = fs.readFileSync("core-performance.js", "utf8");
  const base = frontend.match(/const ROOT='(https:\/\/[^']+\/rest\/v1\/)';/);
  const key = frontend.match(/const APIKEY='(sb_publishable_[^']+)';/);
  assert.ok(base && key, "public Supabase browser configuration is required");
  const views = [
    ["nhl_core42_status", "pending_predictions,finalized_predictions,reviewed_goalies"],
    ["nhl_core_model_accuracy", "model,games,goal_mae,winner_accuracy_pct"],
    ["nhl_core_model_head_to_head", "model,games,goal_mae,winner_accuracy_pct"],
    ["nhl_core_model_trend", "model,game_id,game_date,games,goal_mae,winner_accuracy_pct"],
    ["core43_shadow_predictions_v1", "game_id,core43_away,core43_home,experiment_status,model_version"],
    ["core43_shadow_preview_v1", "game_id,core43_preview_away,core43_preview_home,preview_status,version"],
    ["nhl_core43_public_schedule_evidence", "game_id,kickoff_at,away_team,home_team"],
    ["core43_shadow_readiness_v1", "game_id", true]
  ];
  const failures = [];
  for (const [view, columns, internal] of views) {
    try {
      const url = new URL(view, base[1]);
      url.searchParams.set("select", columns);
      url.searchParams.set("limit", "1");
      const response = await fetch(url, {
        method: "GET",
        headers: { apikey: key[1], Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
        redirect: "error"
      });
      console.log(view + ": HTTP " + response.status);
      if (internal) {
        assert.ok([401, 403].includes(response.status), "internal view must reject public access");
      } else {
        assert.equal(response.status, 200, "public view must remain readable");
        const rows = await response.json();
        assert.ok(Array.isArray(rows) && rows.length <= 1, "expected bounded JSON array");
        for (const row of rows) {
          assert.deepEqual(Object.keys(row).sort(), columns.split(",").sort(), "unexpected response columns");
        }
        console.log(view + ": " + (rows.length ? "shape verified" : "empty response; row shape unverified"));
      }
    } catch {
      failures.push(view);
      console.error(view + ": REST contract failed");
    }
  }
  assert.equal(failures.length, 0, "Failed REST contracts: " + failures.join(", "));
  console.log("Post-deployment REST permissions verified; no SQL was executed.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
