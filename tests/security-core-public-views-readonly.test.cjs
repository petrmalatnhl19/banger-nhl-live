"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const sql = fs.readFileSync("scripts/sql/security_core_public_views_readonly_proposal.sql", "utf8");
const views = ["core43_shadow_predictions_v1","core43_shadow_preview_v1","nhl_core42_status","nhl_core_model_accuracy","nhl_core_model_head_to_head","nhl_core_model_trend"];
test("only six intended reporting views have write privilege revokes", () => {
 const revokes = sql.split("\n").filter(line => /^REVOKE /.test(line));
 assert.equal(revokes.length, views.length);
 for (const view of views) assert.ok(revokes.includes(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${view} FROM anon, authenticated;`));
 assert.doesNotMatch(sql, /^(?:GRANT|ALTER|DROP|CREATE|UPDATE|DELETE FROM|INSERT INTO) /m);
 assert.doesNotMatch(sql, /^REVOKE SELECT /m);
});
