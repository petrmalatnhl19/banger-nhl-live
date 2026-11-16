"use strict";

const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { test } = require("node:test");
const { canonical } = require("./engine.js");
const { inspectSnapshot, sha256 } = require("./reference.cjs");
const { discover, capture, inspectCapture, prepare, pregameStatus } = require("./pregame.cjs");

const gameDate = "2026-11-17";
const gameId = "2026020333";
const scheduledAt = "2026-11-18T00:00:00Z";
const now = Date.parse("2026-11-17T22:50:00Z");
const dataThrough = "2026-11-17T19:00:00Z";
const awayTeam = { abbrev: "LAK" };
const homeTeam = { abbrev: "BOS" };
const key = generateKeyPairSync("ed25519");
const trust = { snapshot: { witness: key.publicKey.export({ type: "spki", format: "pem" }) } };

function fixture() {
  const game = { id: +gameId, gameDate, startTimeUTC: scheduledAt, gameType: 2, season: 20262027,
    gameScheduleState: "OK", gameState: "FUT", awayTeam, homeTeam };
  const previous = { ...game, id: 2026020310, gameDate: "2026-11-16", startTimeUTC: "2026-11-16T23:00:00Z",
    gameState: "OFF" };
  return {
    score: { games: [game] },
    standings: { standingsDateTimeUtc: dataThrough,
      standings: [awayTeam, homeTeam].map(team => ({ teamAbbrev: { default: team.abbrev },
        gamesPlayed: 20, goalFor: 60, goalAgainst: 50 })) },
    awaySchedule: { games: [previous, game] },
    homeSchedule: { games: [previous, game] },
    goalies: { updatedAt: dataThrough, conflicts: [], games: [
      { team: "LAK", opponent: "BOS", gameId, date: gameDate, venue: "away", goalieId: "8471234", status: "projected" },
      { team: "BOS", opponent: "LAK", gameId, date: gameDate, venue: "home", goalieId: "8474567", status: "confirmed" }
    ] },
    lineups: { teams: { kings: { publishedAt: dataThrough, source: "mirror" } } }
  };
}

async function collect(data = fixture(), mode = "capture", at = now) {
  return capture(gameDate, gameId, mode, { now: () => at, fetcher: source(data) });
}

function source(data) {
  return async (url, options) => {
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, url.endsWith("/standings/now") ? "manual" : "error");
    const route = new URL(url).pathname;
    const source = route.includes("/score/") ? "score" : route.includes("/standings/") ? "standings"
      : route.includes("/LAK/") ? "awaySchedule" : route.includes("/BOS/") ? "homeSchedule"
        : route.endsWith("rotowire_goalies.json") ? "goalies" : "lineups";
    return data[source] ? new Response(JSON.stringify(data[source]), {
      headers: { "last-modified": "Mon, 16 Nov 2026 13:00:00 GMT", etag: "etag-claim" }
    }) : new Response("", { status: 503 });
  };
}

function review(bundle, keys) {
  return { captureSha256: sha256(bundle), inputs: Object.fromEntries(keys.map(key => [
    key, { dataThrough, method: "live_retrieval_witness", evidence: "urn:test:observer-record" }
  ])) };
}

function envelope(manifest, observedAt = new Date(now).toISOString()) {
  const statement = { schema: "banger-accuracy-receipt-v1", purpose: "snapshot", keyId: "witness",
    observedAt, sha256: sha256(manifest) };
  return { manifest, receipt: { statement, signature: sign(null, Buffer.from(canonical(statement)), key.privateKey).toString("base64") } };
}

test("discovers future regular-season games without making them eligible outside the capture window", async () => {
  const data = fixture();
  data.score.games.push({ ...data.score.games[0], id: 2026020334, gameState: "LIVE" });
  const [result] = await discover([gameDate], { now: () => now, fetcher: source(data) });
  assert.deepEqual(result.games.map(game => game.gameId), [gameId]);
  await assert.rejects(collect(data, "capture", now - 20 * 60_000), /Capture opens/);
  await assert.rejects(collect(data, "capture", Date.parse(scheduledAt) - 60 * 60_000), /before T−60/);
});

test("archives byte digest and content version independently from HTTP and publication claims", async () => {
  const bundle = await collect();
  const { decoded, candidates } = inspectCapture(bundle);
  assert.equal(decoded.standings.standingsDateTimeUtc, dataThrough);
  assert.equal(bundle.sources.standings.dataPublishedAt, null);
  assert.ok(bundle.sources.standings.lastModified);
  assert.equal(bundle.sources.standings.version, "sha256:" + bundle.sources.standings.sha256);
  assert.deepEqual(Object.keys(candidates), ["schedule", "teamStats", "rest", "goalies"]);
  assert.deepEqual(candidates.rest.payload.home, { restHours: 25, backToBack: true });
  bundle.sources.standings.bytes = Buffer.from("{}").toString("base64");
  assert.equal(inspectCapture(bundle).candidates.teamStats, undefined);
});

test("missing feeds, mismatched goalie identity and future provider metadata are excluded", async () => {
  const data = fixture();
  data.standings.standingsDateTimeUtc = scheduledAt;
  data.goalies.games[1].opponent = "TOR";
  delete data.awaySchedule;
  const bundle = await collect(data);
  assert.deepEqual(Object.keys(inspectCapture(bundle).candidates), ["schedule"]);
  assert.equal(bundle.sources.awaySchedule.status, "http_503");
});

test("probe or delayed capture cannot be prepared as a T−60 snapshot", async () => {
  const probe = await collect(fixture(), "probe");
  assert.throws(() => prepare(probe, review(probe, ["schedule"]), now), /outside the live/);
  const captureBundle = await collect();
  captureBundle.finishedAt = scheduledAt;
  assert.throws(() => prepare(captureBundle, review(captureBundle, ["schedule"]), now), /outside the live/);
  const valid = await collect();
  assert.throws(() => prepare(valid, review(valid, ["schedule"]), Date.parse(scheduledAt)), /outside the live/);
});

test("refuses wrong review digest, future horizon, and claims for unavailable inputs", async () => {
  const captureBundle = await collect();
  const decision = review(captureBundle, ["schedule"]);
  assert.throws(() => prepare(captureBundle, { ...decision, captureSha256: "0".repeat(64) }, now), /exact capture digest/);
  assert.throws(() => prepare(captureBundle, review(captureBundle, ["lineups"]), now), /Invalid review decision/);
  decision.inputs.schedule.dataThrough = scheduledAt;
  assert.throws(() => prepare(captureBundle, decision, now), /Future data horizon/);
});

test("round trips a witnessed capture as incomplete and independently replays its source data", async () => {
  const bundle = await collect();
  const manifest = prepare(bundle, review(bundle, ["schedule", "teamStats", "rest", "goalies"]), now);
  const signed = envelope(manifest);
  assert.equal(manifest.observations.teamStats.availableAt, bundle.sources.standings.retrievedAt);
  assert.equal(manifest.observations.teamStats.provenance.sources[0].dataPublishedAt, null);
  assert.deepEqual(inspectSnapshot(signed, trust.snapshot).missing, ["lineups", "homeAdvantage", "absences"]);
  const status = pregameStatus([bundle, signed], trust);
  assert.equal(status.incomplete, 1);
  assert.equal(status.games[0].stage, "signed");
  assert.equal(status.games[0].observations.length, 4);
  assert.equal(status.comparablePredictions, 0);
  const wrong = structuredClone(manifest);
  wrong.observations.teamStats.payload.home.goalsForPerGame = 9;
  wrong.observations.teamStats.sha256 = sha256(wrong.observations.teamStats.payload);
  assert.equal(pregameStatus([bundle, envelope(wrong)], trust).games[0].stage, "capture");
  wrong.observations.teamStats.provenance.sources[0].dataPublishedAt = dataThrough;
  assert.equal(inspectSnapshot(envelope(wrong), trust.snapshot).reason, "invalid_observation");
});

test("shows a complete independently supplemented snapshot without counting any predictions", async () => {
  const bundle = await collect();
  const manifest = prepare(bundle, review(bundle, ["schedule", "teamStats", "rest", "goalies"]), now);
  for (const [name, payload] of Object.entries({
    lineups: { away: [8123456], home: [8234567] },
    homeAdvantage: { awayAdjustment: 0, homeAdjustment: 0.1 },
    absences: { away: [], home: [] }
  })) {
    manifest.observations[name] = { source: "urn:test:supplement:" + name, dataThrough, availableAt: dataThrough,
      retrievedAt: dataThrough, sha256: sha256(payload), payload };
  }
  assert.equal(pregameStatus([bundle, envelope(manifest)], trust).complete, 1);
  assert.equal(pregameStatus([bundle, envelope(manifest, scheduledAt)], trust).complete, 0);
});


test("follows only the NHL standings alias to a dated endpoint on the same host", async () => {
  const data = fixture();
  const get = source(data);
  const redirect = location => async (url, options) => url.endsWith("/standings/now")
    ? new Response(null, { status: 307, headers: { location } }) : get(url, options);
  const run = location => capture(gameDate, gameId, "capture", { now: () => now, fetcher: redirect(location) });
  const good = await run("/v1/standings/2026-11-16");
  assert.equal(good.sources.standings.resolvedUrl, "https://api-web.nhle.com/v1/standings/2026-11-16");
  assert.ok(inspectCapture(good).candidates.teamStats);
  for (const location of ["https://example.com/v1/standings/2026-11-16", "/v1/score/2026-11-16",
    "/v1/standings/2026-02-30"]) {
    const bad = await run(location);
    assert.equal(bad.sources.standings.status, "redirect_refused");
    assert.equal(inspectCapture(bad).candidates.teamStats, undefined);
  }
});
