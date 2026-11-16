"use strict";

const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync } = require("node:crypto");
const { test } = require("node:test");
const { attestNhlStart, collectNhlSources, verifyProvenance } = require("./core43_cal33_nhl_observer.cjs");

const json = value => Buffer.from(JSON.stringify(value));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const gameId = "2025020001";
const reportUrl = "https://www.nhl.com/scores/htmlreports/20252026/GS020001.HTM";
const boxscoreUrl = "https://api-web.nhle.com/v1/gamecenter/2025020001/boxscore";
const html = `<table id="Visitor"><tr><td><img src="logocchi.gif"></td></tr></table>
<table id="GameInfo"><tr><td>Game Summary</td><td>Tuesday, October 7, 2025</td></tr>
<tr><td>Start&nbsp;5:20&nbsp;EDT; End&nbsp;7:54&nbsp;EDT</td><td>Game 0001</td><td>Final</td></tr></table>
<table id="Home"><tr><td><img src="logocnhl.gif"></td><td><img src="logocfla.gif"></td></tr></table>`;
const boxscore = { id: Number(gameId), startTimeUTC: "2025-10-07T21:00:00Z", gameState: "OFF",
  gameOutcome: { lastPeriodType: "REG" }, awayTeam: { abbrev: "CHI", score: 2 },
  homeTeam: { abbrev: "FLA", score: 3 } };
const review = { actualStartAt: "2025-10-07T21:20:00.000Z", clockCorroboration: "Synthetic evening broadcast fixture" };
const observedAt = "2025-10-08T00:01:00.000Z";
const source = (url, bytes) => ({
  url, retrievedAt: "2025-10-08T00:00:00.000Z", sha256: hash(bytes), bytes: bytes.toString("base64url"),
});
const fixture = (report = html, game = boxscore) => ({
  schema: "core43_cal33_nhl_sources_v1", gameId,
  report: source(reportUrl, Buffer.from(report)), boxscore: source(boxscoreUrl, json(game)),
});
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const attest = (archive, details = review) => attestNhlStart(json(archive), details, privateKey, () => Date.parse(observedAt));

test("CAL-33 archives official source bytes and signs compatible, separate scheduled and actual times", () => {
  const archive = fixture();
  const attestation = attest(archive);
  const statement = JSON.parse(Buffer.from(attestation.nhlStart.statement, "base64url"));
  assert.equal(attestation.trusted, false);
  assert.equal(statement.schema, "core43_cal30_nhl_start_v1");
  assert.equal(statement.kickoffAt, "2025-10-07T21:00:00.000Z");
  assert.equal(statement.actualStartAt, review.actualStartAt);
  assert.equal(statement.precision, "minute");
  assert.equal(statement.observedAt, observedAt);
  assert.equal(statement.reportSha256, archive.report.sha256);
  assert.equal(verifyProvenance(json(archive), attestation, publicKey), true);
  const tampered = structuredClone(archive);
  tampered.boxscore.retrievedAt = observedAt;
  assert.equal(verifyProvenance(json(tampered), attestation, publicKey), false);
  assert.equal(verifyProvenance(json(archive), { ...attestation, nhlStart: {
    ...attestation.nhlStart, report: Buffer.from("replacement").toString("base64url"),
  } }, publicKey), false);
  assert.equal(verifyProvenance(json(archive), attestation, generateKeyPairSync("ed25519").publicKey), false);
});

test("CAL-33 refuses sources without a unique actual time and reviewed clock interpretation", () => {
  const marker = "Start&nbsp;5:20&nbsp;EDT; End&nbsp;7:54&nbsp;EDT";
  for (const report of [html.replace(marker, "Scheduled 5:00 EDT"),
    html.replace("<td>" + marker + "</td>", "<!-- <td>" + marker + "</td> -->"),
    html.replace(marker, marker.replaceAll("EDT", "XYZ")),
    html.replace(marker, marker + "</td><td>" + marker)]) {
    assert.throws(() => attest(fixture(report)), /cal33_actual_start_unavailable/);
  }
  assert.throws(() => attest(fixture(), { ...review, actualStartAt: "2025-10-07T21:00:00.000Z" }),
    /cal33_actual_start_mismatch/);
  assert.throws(() => attest(fixture(), { ...review, clockCorroboration: "" }), /cal33_observer_review/);
  assert.throws(() => attest(fixture(html, { ...boxscore, gameState: "FUT" })), /cal33_boxscore_binding/);
});

test("CAL-33 rejects substitutions in game, teams, hash, source and retrieval time", () => {
  assert.throws(() => attest(fixture(html.replace("Game 0001", "Game 0002"))), /cal33_report_identity/);
  assert.throws(() => attest(fixture(html.replace("logocchi.gif", "logocdal.gif"))), /cal33_report_teams/);
  assert.throws(() => attest(fixture(html, { ...boxscore, id: 2025020002 })), /cal33_boxscore_binding/);
  const archive = fixture();
  assert.throws(() => attest({ ...archive, report: { ...archive.report, sha256: "0".repeat(64) } }), /cal33_source_integrity/);
  assert.throws(() => attest({ ...archive, report: { ...archive.report, url: boxscoreUrl } }), /cal33_source_record/);
  assert.throws(() => attest({ ...archive, report: { ...archive.report, retrievedAt: "2025-10-09T00:00:00.000Z" } }),
    /cal33_acquisition_time/);
});

test("CAL-33 collection uses only the fixed sources and blocks redirected responses", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, method: options.method, redirect: options.redirect });
    const response = new Response(url === reportUrl ? html : json(boxscore), {
      headers: { "content-type": url === reportUrl ? "text/html; charset=utf-8" : "application/json" },
    });
    Object.defineProperty(response, "url", { value: url });
    return response;
  });
  const result = await collectNhlSources(gameId);
  assert.deepEqual(calls, [reportUrl, boxscoreUrl].map(url => ({ url, method: "GET", redirect: "error" })));
  assert.deepEqual(Buffer.from(result.report.bytes, "base64url"), Buffer.from(html));
  await assert.rejects(collectNhlSources("../bad"), /cal33_game_id/);
  globalThis.fetch.mock.mockImplementation(async () => new Response(html, {
    headers: { "content-type": "text/html" },
  }));
  await assert.rejects(collectNhlSources(gameId), /cal33_source_http/);
});
