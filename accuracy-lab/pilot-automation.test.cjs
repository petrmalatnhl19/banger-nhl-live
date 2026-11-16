"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { plan, limitedFetch, encrypt, decrypt, runLive, selectedArtifact } = require("./pilot-automation.cjs");
const { verifyArchive } = require("./pilot.cjs");
const { fixture, at, cutoff, open, start, date, id, published, previewUrl } = require("./pilot-test-fixture.cjs");

const key = Buffer.alloc(32, 1);
const signingKey = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const gamecenter = "https://api-web.nhle.com/v1/gamecenter/" + id + "/landing";
const official = (scheduled = start) => new Response(JSON.stringify({ id: +id, gameDate: date, startTimeUTC: scheduled,
  gameState: "FUT", awayTeam: { abbrev: "DAL" }, homeTeam: { abbrev: "VGK" } }));

function workflowFixture(overrides = {}) {
  const live = fixture();
  return { now: () => at, signingKey, archiveKey: key.toString("hex"), wait: async () => {},
    fetcher: (url, options) => url === gamecenter ? official() : live.fetcher(url, options), ...overrides };
}

test("UTC, Prague, NHL date and dormant cron agree", () => {
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  assert.equal(fmt.format(new Date(plan.scheduledAt)), "04:00");
  assert.equal(fmt.format(new Date(plan.opensAt)), "02:45");
  assert.equal(fmt.format(new Date(plan.referenceAt)), "03:00");
  assert.equal(plan.gameDate, "2026-11-17");
  assert.equal(plan.prospectiveUtcCron, "46 1 18 11 *");
  const workflow = readFileSync(join(__dirname, "..", ".github", "workflows", "core-accuracy-pilot.yml"), "utf8");
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.match(workflow, /^  workflow_call:/m);
  assert.doesNotMatch(workflow, /^  schedule:/m);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /ACCURACY_PILOT_SOURCES_ALLOWED/);
  assert.match(workflow, /actions\/upload-artifact/);
});

test("GET retries a transient response once, honors Retry-After and records times", async () => {
  const events = [];
  const delays = [];
  let requests = 0;
  const fetcher = limitedFetch(async () => ++requests === 1
    ? new Response("busy", { status: 429, headers: { "Retry-After": "1" } }) : new Response("ok"),
  { now: () => at, wait: async ms => delays.push(ms), events });
  const result = await fetcher("https://source.invalid", { method: "GET" });
  assert.equal(result.status, 200);
  assert.deepEqual(delays, [1000]);
  assert.deepEqual(events.map(row => [row.attempt, row.httpStatus]), [[1, 429], [2, 200]]);
  assert.equal(events[0].startedAt, new Date(at).toISOString());
  await assert.rejects(() => fetcher("https://source.invalid", { method: "POST" }), /only supports GET/);
});

test("never retries a permanent 403 or a transient failure close to T−60", async () => {
  for (const [code, now] of [[403, at], [503, cutoff - 10000]]) {
    let calls = 0;
    const get = limitedFetch(async () => { calls++; return new Response("x", { status: code }); },
      { now: () => now, wait: async () => { throw Error("Unexpected wait"); } });
    assert.equal((await get("https://source.invalid", { method: "GET" })).status, code);
    assert.equal(calls, 1);
  }
  await assert.rejects(() => runLive(workflowFixture({ now: () => open - 1 })), /outside/);
  await assert.rejects(() => runLive(workflowFixture({ now: () => cutoff })), /outside/);
});

test("public artifact contains no raw bodies and a sealed pair blocks repeat processing independently of diagnostic artifacts", async () => {
  const result = await runLive(workflowFixture());
  assert.equal(result.sealed, true);
  assert.equal(result.report.internallyCalculated.length, 2);
  assert.equal(result.report.validPairs, 0);
  assert.equal(result.report.timeStatus, "external_confirmation_pending");
  assert.ok(result.report.workflow.checkedByGamecenter);
  assert.equal(result.report.pairAudit.computedAt, new Date(at).toISOString());
  assert.equal(result.report.pairAudit.inputSha256, result.report.modelInputSha256);
  assert.ok(result.report.pairAudit.outputSha256.core41);
  assert.equal(JSON.stringify(result).includes('"bytes"'), false);
  const data = decrypt(result.encrypted, key);
  assert.ok(data.official.bytes && data.archived.capture.officialCrossCheck.bytes);
  verifyArchive(data.archived);
  assert.throws(() => decrypt(result.encrypted, Buffer.alloc(32, 2)));
  assert.throws(() => decrypt({ ...result.encrypted, tag: "00".repeat(16) }, key));
  assert.notEqual(encrypt(data, key).nonce, result.encrypted.nonce);

  const match = { id: 1, name: plan.artifact + "-sealed", expired: false, workflow_run: { head_branch: "core-accuracy-lab-01" } };
  assert.deepEqual(selectedArtifact([match,
    { ...match, name: plan.artifact + "-diagnostic-2" },
    { ...match, expired: true },
    { ...match, workflow_run: { head_branch: "main" } }]), [match]);
});

test("independent schedule disagreement stops collection and preserves diagnostic response", async () => {
  let calls = 0;
  const failed = await runLive(workflowFixture({
    fetcher: async url => {
      calls++;
      assert.equal(url, gamecenter);
      return official("2026-11-18T04:00:00Z");
    }
  }));
  assert.equal(calls, 1);
  assert.equal(failed.report.reason, "official_schedule_not_confirmed");
  assert.equal(failed.sealed, false);
  assert.ok(decrypt(failed.encrypted, key).official.bytes);
});

function fallbackFixture(explicit) {
  const base = fixture();
  const mirror = "https://www.nhl.com/goldenknights/news/" + previewUrl.split("/").at(-1);
  return async (url, options) => {
    if (url === gamecenter) return official();
    if (url.endsWith("rotowire_goalies.json")) return new Response(JSON.stringify({ games: [] }));
    if (url === previewUrl || url.includes("/stars/news/")) return new Response("absent", { status: 404 });
    if (url === mirror) {
      const source = await base.fetcher(previewUrl, options);
      const html = (await source.text()).replace(previewUrl, mirror);
      const withMentions = explicit ? html.replace("***Injured:** None*", "***Injured:** None*\\nFirst Keeper will start in goal.")
        .replace("Golden Knights projected lineup**", "Golden Knights projected lineup**\\nSecond Keeper is confirmed to start in net.") : html;
      return new Response(withMentions);
    }
    const response = await base.fetcher(url, options);
    if (url.includes("/roster/")) {
      const data = await response.json();
      const away = url.includes("/DAL/");
      data.goalies = [{ id: away ? 8401201 : 8401202,
        firstName: { default: away ? "First" : "Second" }, lastName: { default: "Keeper" } }];
      return new Response(JSON.stringify(data));
    }
    return response;
  };
}

test("club preview fallback requires exact matchup and explicit starters with distinct statuses", async () => {
  const result = await runLive(workflowFixture({ fetcher: fallbackFixture(true) }));
  assert.equal(result.sealed, true);
  const capture = decrypt(result.encrypted, key).archived;
  assert.equal(capture.manifest.observations.goalies.payload.away.status, "projected");
  assert.equal(capture.manifest.observations.goalies.payload.home.status, "confirmed");
  assert.ok(capture.manifest.observations.lineups.source.includes("/goldenknights/news/"));

  const missing = await runLive(workflowFixture({ fetcher: fallbackFixture(false) }));
  assert.deepEqual(missing.report.missing, ["goalies"]);
  assert.equal(missing.sealed, false);
  assert.equal(missing.report.internallyCalculated.length, 0);
});
