"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync } = require("node:crypto");
const { sha256 } = require("./reference.cjs");
const { collectPilot, analyze, seal, dashboard, verifyArchive } = require("./pilot.cjs");
const { verifyExport } = require("./external-time.cjs");

const id = "2026020342", date = "2026-11-17";
const start = "2026-11-18T03:00:00Z", cutoff = Date.parse("2026-11-18T02:00:00Z");
const open = cutoff - 15 * 60000, at = cutoff - 10 * 60000;
const published = "2026-11-18T00:10:00Z";
const previewUrl = "https://www.nhl.com/news/dallas-stars-vegas-golden-knights-game-preview-november-17-2026";
const { privateKey } = generateKeyPairSync("ed25519");
const pem = privateKey.export({ type: "pkcs8", format: "pem" });

function fixture(now = () => at) {
  const awayTeam = { abbrev: "DAL", name: { default: "Stars" } };
  const homeTeam = { abbrev: "VGK", name: { default: "Golden Knights" } };
  const game = { id: Number(id), gameDate: date, startTimeUTC: start, gameType: 2, season: 20262027,
    gameState: "FUT", gameScheduleState: "OK", awayTeam, homeTeam };
  const prior = { ...game, id: 2026020321, startTimeUTC: "2026-11-16T02:00:00Z", gameDate: "2026-11-15", gameState: "OFF" };
  const snapshot = { game_id: Number(id), game_date: "2026-11-18", away_team: "DAL", home_team: "VGK",
    status: "pending", goalie32_factors: { goalie_data_missing: false, away_goalie: { shots: 29 }, home_goalie: { shots: 35 } } };
  const components = [
    ["xg4", "banger-xg-v4-5v5-attack-defense", 4.5], ["goalie32", "banger-core-v3.2-goalie-shrinkage", 3.1],
    ["special33", "banger-core-v3.3-specialteams-experimental", 2.8], ["advanced", "banger-core-v3.1-form20", 2.1]
  ];
  for (const [key, version, value] of components) Object.assign(snapshot, {
    [key + "_away"]: value, [key + "_home"]: value + 0.2, [key + "_predicted_at"]: published, [key + "_version"]: version
  });
  const schedule = [{ game_id: Number(id), away_team: "DAL", home_team: "VGK", kickoff_at: start }];
  const rosters = {}, texts = [];
  for (const [team, prefix, base] of [[awayTeam, "Dal", 8400100], [homeTeam, "Vgk", 8400180]]) {
    const names = Array.from({ length: 18 }, (_, i) => ({
      id: base + i, firstName: { default: prefix + i }, lastName: { default: "Fixture" }
    }));
    rosters[team.abbrev] = { forwards: names.slice(0, 12), defensemen: names.slice(12) };
    texts.push("**" + team.name.default + " projected lineup**");
    for (let i = 0; i < names.length;) {
      const unit = names.slice(i, i + (i < 12 ? 3 : 2));
      texts.push(unit.map(row => row.firstName.default + " Fixture").join(" -- "));
      i += unit.length;
    }
    texts.push("***Scratched:** None*", "***Injured:** None*");
  }
  const archiveHeaders = [];
  const fetcher = async (url, options) => {
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (parsed.hostname.endsWith(".supabase.co")) {
      archiveHeaders.push(Boolean(options.headers.apikey?.startsWith("sb_publishable_")));
      assert.equal(parsed.searchParams.get("game_id"), "eq." + id);
    } else assert.equal(options.headers.apikey, undefined);
    if (url === previewUrl) {
      const body = { "@type": "NewsArticle", headline: "Stars at Golden Knights projected lineups",
        articleBody: texts.join("\n"), datePublished: published, dateModified: published };
      return new Response('<link rel="canonical" href="' + url + '"><script type="application/ld+json">'
        + JSON.stringify(body) + "</script>");
    }
    const data = path.includes("/score/") ? { games: [game] }
      : path.includes("/standings/") ? { standingsDateTimeUtc: published, standings: [
        { teamAbbrev: { default: "DAL" }, gamesPlayed: 20, goalFor: 70, goalAgainst: 60 },
        { teamAbbrev: { default: "VGK" }, gamesPlayed: 20, goalFor: 65, goalAgainst: 59 }
      ] } : path.includes("/club-schedule") ? { games: [prior, game] }
        : path.includes("/roster/") ? rosters[path.split("/")[3]]
          : path.endsWith("rotowire_goalies.json") ? { updatedAt: published, conflicts: [], games: [
            { team: "DAL", opponent: "VGK", gameId: id, date, venue: "away", status: "projected", goalieId: 8401201 },
            { team: "VGK", opponent: "DAL", gameId: id, date, venue: "home", status: "confirmed", goalieId: 8401202 }
          ] } : path.endsWith("nhl_prediction_archive") ? [snapshot]
            : path.endsWith("nhl_core43_public_schedule_evidence") ? schedule : {};
    return new Response(JSON.stringify(data));
  };
  return { now, fetcher, snapshot, schedule, archiveHeaders };
}

function rewrite(record, callback) {
  const value = JSON.parse(Buffer.from(record.bytes, "base64").toString());
  callback(value);
  const bytes = Buffer.from(JSON.stringify(value));
  record.bytes = bytes.toString("base64");
  record.sha256 = createHash("sha256").update(bytes).digest("hex");
  record.version = "sha256:" + record.sha256;
}

test("manual window opens at T−75 and closes for new collection at T−60", async () => {
  await assert.rejects(() => collectPilot(date, id, "capture", fixture(() => open - 1)), /Capture opens/);
  await assert.rejects(() => collectPilot(date, id, "capture", fixture(() => cutoff)), /before T−60/);
  const beginning = await collectPilot(date, id, "capture", fixture(() => open));
  assert.equal(analyze(beginning).reason, null);
  assert.doesNotThrow(() => seal(beginning, pem, () => cutoff));
  assert.throws(() => seal(beginning, pem, () => cutoff + 1), /inside the T−60/);
  let checks = 0;
  assert.throws(() => seal(beginning, pem, () => checks++ === 0 ? cutoff : cutoff + 1), /Signing finished after T−60/);
});

test("one captured input yields deterministic v26 results with signed archive binding and unverified time", async () => {
  const options = fixture();
  const capture = await collectPilot(date, id, "capture", options);
  assert.deepEqual(options.archiveHeaders, [true, true]);
  assert.equal(JSON.stringify(capture).includes("sb_publishable_"), false);
  const view = analyze(capture);
  assert.deepEqual(view.missing, []);
  const frozen = seal(capture, pem, () => at);
  assert.equal(frozen.pair.snapshotSha256, sha256(frozen.input));
  assert.deepEqual(frozen.pair, seal(capture, pem, () => at).pair);
  assert.deepEqual(frozen.pair.models.map(model => model.status), ["calculated", "calculated"]);
  assert.notEqual(frozen.pair.models[0].away, frozen.pair.models[1].away);
  assert.equal(frozen.pair.models[1].excluded[0].model, "goalie32");
  assert.equal(verifyExport(frozen.external).timeStatus, "unverified");
  assert.equal(verifyArchive(frozen).archivedAt, new Date(at).toISOString());
  assert.equal(dashboard(frozen).internallyCalculated.length, 2);
  assert.equal(dashboard(frozen).completeSnapshots, 0);
  assert.equal(dashboard(frozen).validPairs, 0);
  assert.deepEqual(dashboard(capture).internallyCalculated, []);
});

test("late source or late data drops the component, so no numbers are manufactured", async () => {
  const capture = await collectPilot(date, id, "capture", fixture());
  const late = structuredClone(capture);
  late.archive.components.retrievedAt = new Date(cutoff + 1).toISOString();
  assert.ok(analyze(late).missing.includes("xg4"));
  assert.equal(seal(late, pem, () => at).pair, null);
  rewrite(capture.archive.components, rows => { rows[0].xg4_predicted_at = new Date(cutoff + 1).toISOString(); });
  const result = seal(capture, pem, () => at);
  assert.deepEqual(result.missing, ["xg4"]);
  assert.equal(result.reason, "required_inputs_missing");
  assert.equal(result.pair, null);
});

test("a future diagnostic probe cannot be signed as a live snapshot", async () => {
  const capture = await collectPilot(date, id, "probe", fixture(() => open - 60000));
  assert.equal(dashboard(capture).status, "diagnostic");
  assert.equal(dashboard(capture).reason, "diagnostic_outside_window");
  assert.deepEqual(dashboard(capture).internallyCalculated, []);
  assert.throws(() => seal(capture, pem, () => at), /inside the T−60/);
});

test("rejects mismatched schedule and unknown or missing component versions", async () => {
  const capture = await collectPilot(date, id, "capture", fixture());
  const wrong = structuredClone(capture);
  rewrite(wrong.archive.archivedSchedule, rows => { rows[0].kickoff_at = "2026-11-18T04:00:00Z"; });
  assert.equal(analyze(wrong).reason, "archive_schedule_unlinked");
  assert.equal(seal(wrong, pem, () => at).pair, null);
  rewrite(capture.archive.components, rows => { rows[0].goalie32_version = "unknown"; });
  assert.deepEqual(analyze(capture).missing, ["goalie32", "goalie32Factors"]);
});

test("archive tampering with an input or a computed goal invalidates the verifiable export", async () => {
  const capture = await collectPilot(date, id, "capture", fixture());
  const frozen = seal(capture, pem, () => at);
  const before = structuredClone(frozen);
  before.capture.archive.components.sha256 = "f".repeat(64);
  assert.throws(() => verifyArchive(before), /does not match/);
  frozen.pair.models[0].home += 1;
  assert.throws(() => verifyArchive(frozen), /does not match/);
});
