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
    "core43_shadow_readiness_v1",
    "nhl_core42_status",
    "nhl_core43_public_schedule_evidence"
  ];
  for (const view of views) {
    const url = new URL(view, base[1]);
    url.searchParams.set("select", view === "nhl_core42_status" ? "pending_predictions" : "game_id");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: { apikey: key[1], Accept: "application/json" },
      signal: AbortSignal.timeout(12000)
    });
    // Log status only; never log payload, authorization headers or individual rows.
    console.log(view + ": HTTP " + response.status);
    if (view === "core43_shadow_readiness_v1") {
      assert.ok([401, 403].includes(response.status), "internal readiness view must reject public access");
    } else {
      assert.equal(response.status, 200, view + " must remain publicly readable");
      assert.ok(Array.isArray(await response.json()), view + " must return a JSON array");
    }
  }
  console.log("Post-deployment REST permissions verified; no SQL was executed.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
