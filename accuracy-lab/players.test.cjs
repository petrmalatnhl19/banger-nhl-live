"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync, sign } = require("node:crypto");
const { canonical } = require("./engine.js");
const { capture, pregameStatus } = require("./pregame.cjs");
const { inspectSnapshot, buildReference, sha256 } = require("./reference.cjs");
const { collectPlayers, inspectPlayers, status } = require("./players.cjs");
const { issueTest, verifyTest } = require("./test-witness.cjs");

const gameDate = "2026-11-15", gameId = "2026020327";
const time = "2026-11-15T23:50:00Z", now = Date.parse(time);
const starts = "2026-11-16T01:00:00Z";
const published = "2026-11-15T22:34:00Z", modified = "2026-11-15T22:35:00Z";
const url = "https://www.nhl.com/news/florida-panthers-dallas-stars-game-preview-november-15-2026";
const awayTeam = { abbrev: "FLA", name: { default: "Panthers" } };
const homeTeam = { abbrev: "DAL", name: { default: "Stars" } };

function fixture() {
  const game = { id: Number(gameId), gameDate, startTimeUTC: starts, gameType: 2, season: 20262027,
    gameState: "FUT", gameScheduleState: "OK", awayTeam, homeTeam };
  const rosters = {};
  const texts = [];
  for (const [side, team, first] of [["away", awayTeam, "F"], ["home", homeTeam, "D"]]) {
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: (side === "away" ? 8400100 : 8400200) + i,
      firstName: { default: first + i }, lastName: { default: "Testing" } }));
    rosters[team.abbrev] = { forwards: rows.slice(0, 12), defensemen: rows.slice(12, 18), goalies: rows.slice(18) };
    const name = i => first + i + " Testing";
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13], [14, 15], [16, 17]];
    texts.push("**" + team.name.default + " projected lineup**", ...lines.map(line => line.map(name).join(" -- ")),
      "***Scratched:** " + name(18) + "*", "***Injured:** " + name(19) + " (upper body, day to day)*");
  }
  function get(input, options) {
    assert.equal(options.method, "GET");
    const path = new URL(input).pathname;
    if (input === url) {
      const article = { "@type": "NewsArticle", headline: "Panthers at Stars projected lineups",
        articleBody: texts.join("\n\n"), datePublished: published, dateModified: modified };
      return new Response('<link rel="canonical" href="' + url + '"><script type="application/ld&#x2B;json">'
        + JSON.stringify(article) + "</script>");
    }
    const prior = { ...game, id: 2026020321, startTimeUTC: "2026-11-14T22:00:00Z", gameDate: "2026-11-14", gameState: "OFF" };
    const data = path.startsWith("/v1/score") ? { games: [game] }
      : path.startsWith("/v1/roster") ? rosters[path.split("/")[3]]
        : path.startsWith("/v1/standings") ? { standingsDateTimeUtc: modified,
          standings: [awayTeam, homeTeam].map(t => ({ teamAbbrev: { default: t.abbrev }, gamesPlayed: 20, goalFor: 60, goalAgainst: 54 })) }
          : path.startsWith("/v1/club") ? { games: [prior, game] }
            : path.endsWith("rotowire_goalies.json") ? { updatedAt: modified, conflicts: [], games: [
              { team: "FLA", opponent: "DAL", gameId, date: gameDate, status: "projected", venue: "away", goalieId: 8400011 },
              { team: "DAL", opponent: "FLA", gameId, date: gameDate, status: "projected", venue: "home", goalieId: 8400012 }
            ] } : {};
    return new Response(JSON.stringify(data));
  }
  return { fetcher: async (...args) => get(...args), now: () => now, game, texts, rosters };
}

async function request() {
  const options = fixture();
  const input = await capture(gameDate, gameId, "capture", options);
  const players = await collectPlayers(gameDate, gameId, input, options);
  const review = { captureSha256: sha256(input), inputs: Object.fromEntries(["schedule", "teamStats", "rest", "goalies"]
    .map(key => [key, { dataThrough: published, method: "live_retrieval_witness", evidence: "urn:test:fixture" }])) };
  const payload = { homeAdjustment: 0.1, awayAdjustment: 0 };
  return { schema: "banger-accuracy-test-request-v1", capture: input, review, players,
    homeAdvantage: { source: "urn:test:fixture:config", payload, sha256: sha256(payload), dataThrough: published,
      availableAt: modified, retrievedAt: time } };
}

function rehash(row, mutate) {
  const bytes = Buffer.from(mutate(Buffer.from(row.bytes, "base64").toString("utf8")));
  row.bytes = bytes.toString("base64");
  row.sha256 = createHash("sha256").update(bytes).digest("hex");
  row.version = "sha256:" + row.sha256;
}

test("maps each official article row to exact team NHL ID and keeps published, modified and retrieved distinct", async () => {
  const input = await request();
  const view = inspectPlayers(input.players);
  assert.equal(view.timely, true);
  assert.equal(view.records.length, 40);
  assert.equal(view.records.filter(row => row.group === "lineups").length, 36);
  assert.equal(view.records.filter(row => row.group === "absences").length, 4);
  assert.deepEqual(view.missing, []);
  assert.deepEqual(view.records[0], { gameId, playerId: 8400100, team: "FLA", group: "lineups", status: "projected",
    source: url, publishedAt: published, modifiedAt: modified, retrievedAt: time.replace("Z", ".000Z"),
    sha256: input.players.sources.preview.sha256, rosterRetrievedAt: time.replace("Z", ".000Z"),
    rosterSha256: input.players.sources.awayRoster.sha256 });
  assert.equal(status(input.players).complete, 0);
});

test("marks absence list missing and does not resolve ambiguities or unrelated names", async () => {
  const options = fixture();
  options.texts.splice(options.texts.findIndex(x => x.startsWith("***Injured")), 1);
  options.rosters.FLA.forwards.push({ ...options.rosters.FLA.forwards[0], id: 8401111 });
  const raw = await collectPlayers(gameDate, gameId, undefined, options);
  const view = inspectPlayers(raw);
  assert.equal(view.timely, false);
  assert.deepEqual(view.missing, ["lineups", "absences"]);
  assert.equal(view.unavailable[0].reason, "nhl_identity_unresolved_or_ambiguous");
  assert.equal(view.records.some(row => row.playerId === 8401111), false);
});

test("rejects wrong game, changed content and publisher edits after the archived retrieval", async () => {
  const raw = (await request()).players;
  const wrong = structuredClone(raw);
  wrong.game.id = "2026020999";
  assert.throws(() => inspectPlayers(wrong), /NHL game/);
  raw.sources.preview.bytes = Buffer.from("fake").toString("base64");
  assert.equal(inspectPlayers(raw).records.length, 0);
  const late = (await request()).players;
  rehash(late.sources.preview, text => text.replace(modified, "2026-11-16T00:10:00Z"));
  assert.equal(inspectPlayers(late).timely, false);
  assert.equal(inspectPlayers(late).records.length, 0);
});

test("explicit confirmation is separated from projected source and lack of evidence", async () => {
  const raw = (await request()).players;
  rehash(raw.sources.preview, text => text.replace("Panthers projected lineup", "Panthers confirmed lineup"));
  const result = inspectPlayers(raw);
  assert.equal(result.quality.away.status, "confirmed");
  assert.equal(result.quality.home.status, "projected");
  rehash(raw.sources.preview, text => text.replace("<link rel=", "<bad rel="));
  assert.equal(inspectPlayers(raw).quality.away.status, "unavailable");
});

test("test witness validates all input groups but is excluded from normal archival and pairing", async () => {
  const input = await request();
  const receipt = issueTest(input, now);
  const result = verifyTest(input, receipt);
  assert.deepEqual(result.missing, []);
  assert.equal(result.eligibleForPairing, false);
  assert.equal(result.independentlyVerified, false);
  assert.equal(inspectSnapshot({ manifest: result.manifest, receipt }).status, "rejected");
  assert.throws(() => pregameStatus([{ manifest: result.manifest, receipt }]), /Invalid signed snapshot/);
  const data = buildReference([{
    id: gameId, away: "FLA", home: "DAL", scheduledAt: starts, actualStartAt: "2026-11-16T01:08:00Z"
  }], { snapshots: [{ manifest: result.manifest, receipt }] });
  assert.equal(data.records.length, 0);
  const key = generateKeyPairSync("ed25519");
  const statement = { schema: "banger-accuracy-receipt-v1", purpose: "snapshot", keyId: "test",
    observedAt: time, sha256: sha256(result.manifest) };
  const standard = { statement, signature: sign(null, Buffer.from(canonical(statement)), key.privateKey).toString("base64") };
  assert.equal(inspectSnapshot({ manifest: result.manifest, receipt: standard }, {
    test: key.publicKey.export({ type: "spki", format: "pem" })
  }).reason, "invalid_snapshot");
});

test("test witness refuses scoped capture changes, late clocks and modified signatures", async () => {
  const input = await request();
  assert.throws(() => issueTest(input, Date.parse(starts)), /outside/);
  const receipt = issueTest(input, now);
  const wrong = structuredClone(input);
  wrong.players.captureSha256 = "f".repeat(64);
  assert.throws(() => issueTest(wrong, now), /same NHL score/);
  assert.throws(() => verifyTest(wrong, receipt), /Invalid test receipt/);
  receipt.signature = Buffer.alloc(64).toString("base64");
  assert.throws(() => verifyTest(input, receipt), /Invalid test signature/);
  const incomplete = structuredClone(input);
  delete incomplete.homeAdvantage;
  assert.deepEqual(verifyTest(incomplete, issueTest(incomplete, now)).missing, ["homeAdvantage"]);
});
