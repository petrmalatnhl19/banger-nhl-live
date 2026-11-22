"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = path => fs.readFileSync(path, "utf8");
const performance = read("core-performance.js");
const tv = read("scripts/banger_tv_match_stats.js");
const verified = read("scripts/core43_verified_dashboard.js");
const scheduleSql = read("scripts/sql/core43_public_schedule_evidence.sql");
const auditSql = read("scripts/sql/security_public_core_views_audit.sql");

test("CORE analytics must retain its four public REST view contracts", () => {
  for (const view of ["nhl_core_model_accuracy", "nhl_core_model_head_to_head", "nhl_core_model_trend", "nhl_core42_status"]) {
    assert.ok(performance.includes("fetchView('"+view+"'"), view+" missing from CORE analytics");
    assert.ok(auditSql.includes("('"+view+"')"), view+" missing from security audit");
  }
});

test("TV pregame keeps archive and both CORE 4.3 shadow REST endpoints", () => {
  for (const endpoint of ["nhl_prediction_archive?select=", "core43_shadow_predictions_v1?select=", "core43_shadow_preview_v1?select="]) {
    assert.ok(tv.includes(endpoint), endpoint+" missing from TV stats");
  }
  for (const view of ["core43_shadow_predictions_v1", "core43_shadow_preview_v1", "core43_shadow_readiness_v1"]) {
    assert.ok(auditSql.includes("('"+view+"')"), view+" missing from audit");
  }
});

test("verified accuracy reads minimal public schedule evidence, never raw snapshots", () => {
  for (const src of [performance, verified]) {
    assert.match(src, /nhl_core43_public_schedule_evidence\?select=game_id,away_team,home_team,kickoff_at/);
    assert.doesNotMatch(src, /nhl_core43_schedule_snapshots\?select=/);
  }
  assert.match(scheduleSql, /SELECT DISTINCT game_id, kickoff_at, away_team, home_team/);
  assert.match(scheduleSql, /security_barrier\s*=\s*true/i);
  assert.doesNotMatch(scheduleSql, /GRANT SELECT ON public\.nhl_core43_schedule_snapshots/i);
});

test("audit SQL is read-only and includes all eight views", () => {
  const names = ["nhl_core42_status","nhl_core_model_accuracy","nhl_core_model_head_to_head","nhl_core_model_trend","core43_shadow_predictions_v1","core43_shadow_preview_v1","core43_shadow_readiness_v1","nhl_core43_public_schedule_evidence"];
  for (const name of names) assert.ok(auditSql.includes("('"+name+"')"), name+" missing");
  const executable = auditSql.replace(/--[^\n]*/g,"").replace(/\/\*[\s\S]*?\*\//g,"");
  assert.doesNotMatch(executable, /\b(?:ALTER|CREATE|DROP|TRUNCATE|REVOKE|GRANT|INSERT|UPDATE|DELETE|DO|CALL)\b/i);
  assert.match(executable, /pg_get_viewdef/);
  assert.match(executable, /pg_policies/);
});
