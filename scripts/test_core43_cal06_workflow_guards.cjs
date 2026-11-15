"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { scopedTransport } = require("./core43_cal04_scheduled_dryrun.cjs");

const workflow = fs.readFileSync(".github/workflows/core43-cal04-scheduled-dryrun.yml", "utf8");
assert.match(workflow, /secrets\.CORE43_SUPABASE_PUBLISHABLE_KEY/);
assert.match(workflow, /secrets\.CORE43_SUPABASE_READONLY_TOKEN/);
assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(workflow, /dry-run:\s*(?:#.*\n\s*)?if: >-\s+false &&/);
assert.match(workflow, /github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/);
assert.match(workflow, /bash scripts\/core43_cal04_restore_ledger\.sh/);

const migration = fs.readFileSync("docs/sql/core43-cal06-reader-migration-draft.sql", "utf8");
const sql = migration.replace(/^--[^\n]*\n/gm, "").trim();
assert.match(sql, /^BEGIN;[\s\S]+COMMIT;$/);
assert.match(sql, /CREATE ROLE core43_cal04_reader\s+NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE\s+NOREPLICATION NOBYPASSRLS;/);
assert.match(sql, /GRANT USAGE ON SCHEMA public TO core43_cal04_reader;/);
assert.match(sql, /GRANT core43_cal04_reader TO authenticator WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;/);
assert.match(sql, /c\.relrowsecurity/);
assert.match(sql, /has_function_privilege\(reader, p\.oid, 'EXECUTE'\)/);
assert.match(sql, /has_any_column_privilege\(reader, c\.oid, 'SELECT, INSERT, UPDATE, REFERENCES'\)/);
assert.match(sql, /has_sequence_privilege\(reader, c\.oid, 'USAGE, SELECT, UPDATE'\)/);
assert.match(sql, /has_schema_privilege\(reader, n\.oid, 'CREATE'\)/);
assert.deepEqual(sql.match(/\bGRANT\b[^;]+;/g), [
  "GRANT USAGE ON SCHEMA public TO core43_cal04_reader;",
  "GRANT SELECT (%s) ON TABLE public.%I TO %I', source.columns, source.table_name, reader);",
  "GRANT core43_cal04_reader TO authenticator WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;",
]);
assert.deepEqual(sql.match(/\bCREATE POLICY\b[^;]+;/g), [
  "CREATE POLICY core43_cal04_reader_select ON public.%I FOR SELECT TO %I USING (true)',\n            source.table_name, reader);",
]);
assert.doesNotMatch(sql, /(?:DISABLE ROW LEVEL SECURITY|SECURITY DEFINER|ALTER DEFAULT PRIVILEGES|CREATE (?:FUNCTION|PROCEDURE)|\bREVOKE\b)/i);

const apiKey = "sb_publishable_fixture";
const exp = Math.ceil(Date.now() / 1000) + 60;
const jwt = claims => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.fixture`;
const token = jwt({ role: "core43_cal04_reader", exp });
const project = "https://example.supabase.co/rest/v1/nhl_prediction_archive";
const read = scopedTransport({ apiKey, token, fetchImpl(url, options) {
  assert.equal(url, project);
  assert.equal(options.redirect, "error");
  assert.deepEqual(options.headers, { apikey: apiKey, Authorization: `Bearer ${token}`, Accept: "application/json" });
  return "read";
} });
assert.equal(read(project, { method: "GET", headers: { Authorization: "old", Accept: "application/json" } }), "read");
assert.throws(() => read(project, { method: "POST" }), /supabase_readonly_requires_get/);
assert.throws(() => scopedTransport({ apiKey: "sb_secret_fixture", token }), /invalid_supabase_publishable_key/);
for (const badToken of ["sb_secret_fixture", ...["service_role", "anon", "authenticated"].map(role => jwt({ role, exp })), jwt({ role: "core43_cal04_reader", exp: 1 })]) {
  assert.throws(() => scopedTransport({ apiKey, token: badToken }), /invalid_supabase_readonly_token/);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "core43-cal06-"));
try {
  const ledgerPath = path.join(dir, "ledger.json");
  const reportPath = path.join(dir, "report.json");
  const ledger = { schema: "core43_cal04_keys_v1", keys: ["42:core43_cal03_dryrun_v1:2026-11-09T23:00:00Z:60m:0"] };
  const report = { schema: "core43_cal04_dryrun_report_v1", mode: "read_only", production: false, databaseWrites: 0, ledger };
  fs.writeFileSync(reportPath, JSON.stringify(report));
  fs.writeFileSync(path.join(dir, "gh"), `#!/usr/bin/env bash
set -eu
if [[ "$1" == api ]]; then
  [[ "$*" == *'--method GET repos/owner/repo/actions/workflows/core43-cal04-scheduled-dryrun.yml/runs'* ]]
  [[ "$*" == *'branch=main'* && "$*" == *'status=success'* ]]
  if [[ "$*" == *'event=schedule'* ]]; then
    [[ "$MOCK_DOWNLOAD" != api-error ]] || exit 1
    printf '%s\n' "$SCHEDULE_RUNS"
  else
    [[ "$*" == *'event=workflow_dispatch'* ]]
    printf '%s\n' "$DISPATCH_RUNS"
  fi
else
  [[ "$*" == 'run download 41 --repo owner/repo --name core43-cal04-readonly-report --dir '* ]]
  [[ "$MOCK_DOWNLOAD" != missing ]] || exit 1
  cp "$REPORT_PATH" "$9/core43-cal04-report.json"
fi
`, { mode: 0o700 });

  const run = (id, created_at, { event = "schedule", head_branch = "main", conclusion = "success" } = {}) =>
    ({ id, created_at, event, head_branch, conclusion });
  const schedule = [run(42, "2026-11-15T05:00Z"), run(80, "2026-11-15T04:00Z", { head_branch: "other" }), run(41, "2026-11-15T03:00Z")];
  const dispatch = [run(38, "2026-11-15T02:00Z", { event: "workflow_dispatch" })];
  function restore({ schedules = schedule, dispatches = dispatch, event = "schedule", bootstrap = "false", download = "ok" } = {}) {
    fs.rmSync(ledgerPath, { force: true });
    return spawnSync("bash", ["scripts/core43_cal04_restore_ledger.sh"], { encoding: "utf8", env: {
      ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_REPOSITORY: "owner/repo", GITHUB_REF_NAME: "main",
      GITHUB_RUN_ID: "42", GITHUB_EVENT_NAME: event, CORE43_CAL04_LEDGER_PATH: ledgerPath,
      CORE43_CAL04_BOOTSTRAP_LEDGER: bootstrap, MOCK_DOWNLOAD: download, REPORT_PATH: reportPath,
      SCHEDULE_RUNS: JSON.stringify({ workflow_runs: schedules }), DISPATCH_RUNS: JSON.stringify({ workflow_runs: dispatches }),
    } });
  }
  const restored = restore();
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(JSON.parse(fs.readFileSync(ledgerPath, "utf8")).keys[0], ledger.keys[0].replace("00Z", "00.000Z"));
  const assertFailed = options => {
    const result = restore(options);
    assert.ok(result.status > 0, result.stderr || String(result.error));
    assert.equal(fs.existsSync(ledgerPath), false);
    return result.stderr;
  };
  assertFailed({ download: "api-error", event: "workflow_dispatch", bootstrap: "true" });
  assertFailed({ download: "missing", event: "workflow_dispatch", bootstrap: "true" });
  fs.writeFileSync(reportPath, "{corrupt json");
  assert.match(assertFailed(), /SyntaxError/);
  fs.writeFileSync(reportPath, JSON.stringify({ ...report, databaseWrites: 1 }));
  assert.match(assertFailed(), /invalid_prior_artifact_report/);
  fs.writeFileSync(reportPath, JSON.stringify({ ...report, ledger: { ...ledger, keys: [42] } }));
  assert.match(assertFailed(), /invalid_readonly_ledger/);
  const noPrior = { schedules: [], dispatches: [], bootstrap: "true" };
  assert.match(assertFailed(noPrior), /missing_prior_artifact_ledger/);
  assert.match(assertFailed({ ...noPrior, event: "workflow_dispatch", bootstrap: "false" }), /missing_prior_artifact_ledger/);
  const initialized = restore({ ...noPrior, event: "workflow_dispatch" });
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(ledgerPath, "utf8")).keys, []);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("CORE43-CAL-06 credential and workflow restore regressions passed");
