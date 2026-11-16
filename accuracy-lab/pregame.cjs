"use strict";

const { createHash } = require("node:crypto");
const { readFileSync, statSync } = require("node:fs");
const { canonical, timestamp } = require("./engine.js");
const { policy, required, availability, inspectSnapshot, sha256 } = require("./reference.cjs");
const { writeArchive } = require("./snapshot.cjs");

const NHL = "https://api-web.nhle.com/v1/";
const STANDINGS = NHL + "standings/now";
const MIRROR = "https://raw.githubusercontent.com/petrmalatnhl19/banger-nhl-live/main/";
const SOURCE_LIMIT = 2_000_000;
const captureSchema = "banger-accuracy-pregame-capture-v1";
const sourceFormat = "nhl-and-banger-public-json-v1";
const minute = 60_000;
const windowMinutes = 75;
const teamCode = value => typeof value === "string" && /^[A-Z]{3}$/.test(value);
const gameId = value => typeof value === "string" && /^\d{10}$/.test(value);
const day = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(timestamp(value + "T00:00:00Z"));
const iso = value => new Date(value).toISOString();
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sides = ["away", "home"];
const arrays = value => Array.isArray(value) ? value : [];
const before = value => timestamp(value) - policy.leadMinutes * minute;

function permittedSource(requested, resolved) {
  if (requested === resolved) return true;
  const prefix = NHL + "standings/";
  return requested === STANDINGS && typeof resolved === "string" && resolved.startsWith(prefix)
    && day(resolved.slice(prefix.length));
}

async function fetchSource(url, fetcher, now, format = "json") {
  const requestedAt = iso(now());
  try {
    const options = {
      method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12_000),
      headers: { Accept: format === "html" ? "text/html" : "application/json", "User-Agent": "BangerNHLResearch/0.4" }
    };
    let resolvedUrl = url;
    let response = await fetcher(url, url === STANDINGS ? { ...options, redirect: "manual" } : options);
    if (url === STANDINGS && [301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw Error("redirect_refused");
      resolvedUrl = new URL(location, url).href;
      if (resolvedUrl === url || !permittedSource(url, resolvedUrl)) throw Error("redirect_refused");
      response = await fetcher(resolvedUrl, options);
    }
    if (!response.ok || (response.url && response.url !== resolvedUrl)) return { url, requestedAt, status: "http_" + response.status };
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.byteLength;
      if (length > SOURCE_LIMIT) throw Error("source_too_large");
      chunks.push(chunk);
    }
    const retrievedAt = iso(now());
    const bytes = Buffer.concat(chunks);
    if (format === "json") JSON.parse(bytes.toString("utf8"));
    const hash = digest(bytes);
    return { url, resolvedUrl, requestedAt, status: "ok", retrievedAt, sha256: hash, version: "sha256:" + hash,
      dataPublishedAt: null, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"),
      bytes: bytes.toString("base64") };
  } catch (error) {
    return { url, requestedAt, status: ["source_too_large", "redirect_refused"].includes(error.message) ? error.message : "unavailable_or_invalid_json" };
  }
}

function readSource(row, url, format = "json") {
  if (row?.url !== url || !permittedSource(url, row.resolvedUrl) || row.status !== "ok" || row.dataPublishedAt !== null
    || !Number.isFinite(timestamp(row.requestedAt)) || !Number.isFinite(timestamp(row.retrievedAt))
    || timestamp(row.requestedAt) > timestamp(row.retrievedAt)
    || typeof row.bytes !== "string" || row.bytes.length > Math.ceil(SOURCE_LIMIT / 3) * 4) return null;
  const bytes = Buffer.from(row.bytes, "base64");
  if (bytes.length > SOURCE_LIMIT || bytes.toString("base64") !== row.bytes
    || digest(bytes) !== row.sha256 || row.version !== "sha256:" + row.sha256) return null;
  try {
    return format === "html" ? bytes.toString("utf8") : JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
}

function upcoming(schedule, requestedDay) {
  const games = arrays(schedule?.games);
  const counts = new Map();
  for (const row of games) counts.set(row?.id, (counts.get(row?.id) ?? 0) + 1);
  return games.filter(row => counts.get(row?.id) === 1 && row?.gameDate === requestedDay
    && row.gameType === 2 && row.gameScheduleState === "OK" && ["FUT", "PRE"].includes(row.gameState)
    && gameId(String(row.id)) && /^\d{8}$/.test(String(row.season)) && teamCode(row.awayTeam?.abbrev)
    && teamCode(row.homeTeam?.abbrev) && row.awayTeam.abbrev !== row.homeTeam.abbrev
    && Number.isSafeInteger(before(row.startTimeUTC))).map(row => ({
    gameId: String(row.id), gameDate: row.gameDate, season: String(row.season),
    away: row.awayTeam.abbrev, home: row.homeTeam.abbrev,
    scheduledAt: row.startTimeUTC, referenceAt: iso(before(row.startTimeUTC)),
    opensAt: iso(timestamp(row.startTimeUTC) - windowMinutes * minute)
  }));
}

function sourceUrls(date, game) {
  return {
    score: NHL + "score/" + date,
    standings: STANDINGS,
    awaySchedule: NHL + "club-schedule-season/" + game.away + "/" + game.season,
    homeSchedule: NHL + "club-schedule-season/" + game.home + "/" + game.season,
    goalies: MIRROR + "rotowire_goalies.json",
    lineups: MIRROR + "lineups.json"
  };
}

async function discover(dates, { fetcher = fetch, now = Date.now } = {}) {
  if (!dates.length || dates.length > 7 || dates.some(date => !day(date))) throw Error("Use 1–7 valid NHL calendar dates");
  return Promise.all([...new Set(dates)].map(async date => {
    const url = NHL + "score/" + date;
    const source = await fetchSource(url, fetcher, now);
    const rows = upcoming(readSource(source, url), date);
    return { date, status: source.status, games: rows.filter(game => timestamp(game.referenceAt) > now()) };
  }));
}

async function capture(date, id, mode, { fetcher = fetch, now = Date.now } = {}) {
  if (!day(date) || !gameId(id) || !["capture", "probe"].includes(mode)) throw Error("Invalid date, NHL Game ID or capture mode");
  const url = NHL + "score/" + date;
  const score = await fetchSource(url, fetcher, now);
  const game = upcoming(readSource(score, url), date).find(row => row.gameId === id);
  if (!game || now() >= timestamp(game.referenceAt)) throw Error("No eligible future NHL game before T−60");
  if (mode === "capture" && now() < timestamp(game.opensAt)) throw Error("Capture opens at " + game.opensAt);
  const requests = Object.entries(sourceUrls(date, game)).filter(([name]) => name !== "score");
  const results = await Promise.all(requests.map(async ([name, source]) => [name, await fetchSource(source, fetcher, now)]));
  return { schema: captureSchema, sourceFormat, mode, game, finishedAt: iso(now()),
    sources: { score, ...Object.fromEntries(results) } };
}

function standingsStats(data, code) {
  const matches = arrays(data?.standings).filter(row => row?.teamAbbrev?.default === code);
  if (matches.length !== 1) return null;
  const { gamesPlayed, goalFor, goalAgainst } = matches[0];
  if (![gamesPlayed, goalFor, goalAgainst].every(x => Number.isSafeInteger(x) && x >= 0) || gamesPlayed === 0) return null;
  return { gamesPlayed, goalsForPerGame: goalFor / gamesPlayed, goalsAgainstPerGame: goalAgainst / gamesPlayed };
}

function rest(data, game, side) {
  const code = game[side];
  const games = arrays(data?.games).filter(row => row?.gameType === 2
    && [row.awayTeam?.abbrev, row.homeTeam?.abbrev].includes(code));
  const target = games.filter(row => String(row.id) === game.gameId);
  if (target.length !== 1 || target[0].startTimeUTC !== game.scheduledAt || target[0].gameDate !== game.gameDate
    || target[0].awayTeam?.abbrev !== game.away || target[0].homeTeam?.abbrev !== game.home) return null;
  const prior = games.filter(row => timestamp(row.startTimeUTC) < timestamp(game.scheduledAt)
    && row.gameScheduleState === "OK").sort((a, b) => timestamp(b.startTimeUTC) - timestamp(a.startTimeUTC));
  const last = prior[0];
  if (!last || !["OFF", "FINAL"].includes(last.gameState) || timestamp(last.startTimeUTC) >= timestamp(game.referenceAt)
    || (prior[1] && timestamp(prior[1].startTimeUTC) === timestamp(last.startTimeUTC)) || !day(last.gameDate)) return null;
  const gameDayGap = (Date.parse(game.gameDate) - Date.parse(last.gameDate)) / 86_400_000;
  if (gameDayGap < 0) return null;
  return { restHours: (timestamp(game.scheduledAt) - timestamp(last.startTimeUTC)) / 3_600_000,
    backToBack: gameDayGap === 1 };
}

function goalie(data, game, side) {
  const expectedOpponent = game[side === "away" ? "home" : "away"];
  const rows = arrays(data?.games).filter(row => row?.team === game[side]
    && String(row.gameId) === game.gameId && row.date === game.gameDate && row.venue === side
    && row.opponent === expectedOpponent);
  if (rows.length !== 1 || !["projected", "confirmed"].includes(rows[0].status)) return null;
  const identity = rows[0].goalieId;
  const playerId = Number(identity);
  return /^\d{7}$/.test(String(identity)) && Number.isSafeInteger(playerId) ? { playerId, status: rows[0].status } : null;
}

function inspectCapture(bundle) {
  const { game, mode, sources, finishedAt } = bundle ?? {};
  if (bundle?.schema !== captureSchema || bundle.sourceFormat !== sourceFormat || !["capture", "probe"].includes(mode)
    || !day(game?.gameDate) || !gameId(game?.gameId) || !teamCode(game?.away) || !teamCode(game?.home)
    || !/^\d{8}$/.test(game?.season ?? "") || !sources || !Number.isFinite(timestamp(finishedAt))) {
    throw Error("Invalid capture format");
  }
  const urls = sourceUrls(game.gameDate, game);
  const decoded = Object.fromEntries(Object.entries(urls).map(([name, url]) => [name, readSource(sources[name], url)]));
  const selected = upcoming(decoded.score, game.gameDate).find(row => row.gameId === game.gameId);
  if (!selected || canonical(selected) !== canonical(game)) throw Error("NHL schedule bytes do not match the selected game");
  const closes = timestamp(game.referenceAt);
  const opens = timestamp(game.opensAt);
  const timely = mode === "capture" && timestamp(sources.score.retrievedAt) >= opens && timestamp(finishedAt) <= closes;
  for (const [name, data] of Object.entries(decoded)) {
    const seen = timestamp(sources[name]?.retrievedAt);
    if (!data || seen > timestamp(finishedAt) || seen > closes || (mode === "capture" && seen < opens)) decoded[name] = null;
  }
  const candidates = {};
  const add = (name, payload, sourceNames) => {
    if (payload && sourceNames.every(key => decoded[key])) candidates[name] = { payload, sourceNames };
  };
  const both = (fn) => {
    const [away, home] = sides.map(fn);
    return away && home ? { away, home } : null;
  };
  add("schedule", { gameId: game.gameId, away: game.away, home: game.home, scheduledAt: game.scheduledAt }, ["score"]);
  const standingsAt = timestamp(decoded.standings?.standingsDateTimeUtc);
  if (Number.isFinite(standingsAt) && standingsAt <= timestamp(sources.standings?.retrievedAt)) {
    add("teamStats", both(side => standingsStats(decoded.standings, game[side])), ["standings"]);
  }
  add("rest", both(side => rest(decoded[side + "Schedule"], game, side)), ["awaySchedule", "homeSchedule"]);
  const goalies = both(side => goalie(decoded.goalies, game, side));
  const mirrorUpdatedAt = timestamp(decoded.goalies?.updatedAt);
  if (goalies && goalies.away.playerId !== goalies.home.playerId && Number.isFinite(mirrorUpdatedAt)
    && mirrorUpdatedAt <= timestamp(sources.goalies?.retrievedAt) && !arrays(decoded.goalies.conflicts).length) {
    add("goalies", goalies, ["goalies"]);
  }
  return { candidates, timely, decoded };
}

function prepare(bundle, review, now = Date.now()) {
  const { timely, candidates } = inspectCapture(bundle);
  const { game } = bundle;
  const cutoff = timestamp(game.referenceAt);
  if (!timely || now < timestamp(bundle.finishedAt) || now > cutoff) throw Error("Capture or review is outside the live T−60 procedure");
  const captureSha256 = sha256(bundle);
  if (review?.captureSha256 !== captureSha256 || !review.inputs || Array.isArray(review.inputs)
    || typeof review.inputs !== "object") throw Error("Review must identify the exact capture digest");
  const observations = {};
  for (const [name, decision] of Object.entries(review.inputs)) {
    if (!Object.hasOwn(candidates, name) || decision?.method !== "live_retrieval_witness"
      || typeof decision.evidence !== "string" || !/^(https:\/\/[^\s]+|urn:[^\s]+)$/.test(decision.evidence)
      || !Number.isFinite(timestamp(decision.dataThrough))) throw Error("Invalid review decision: " + name);
    const candidate = candidates[name];
    const sources = candidate.sourceNames.map(key => {
      const { resolvedUrl, sha256, version, retrievedAt, dataPublishedAt } = bundle.sources[key];
      return { url: resolvedUrl, sha256, version, retrievedAt, dataPublishedAt };
    });
    const retrievedAt = iso(Math.max(...sources.map(source => timestamp(source.retrievedAt))));
    if (timestamp(decision.dataThrough) > timestamp(retrievedAt)) throw Error("Future data horizon: " + name);
    observations[name] = {
      source: sources.length === 1 ? sources[0].url : "urn:banger:nhl:rest:" + game.gameId,
      dataThrough: decision.dataThrough, availableAt: retrievedAt, retrievedAt, sha256: sha256(candidate.payload),
      payload: candidate.payload, provenance: { captureSha256, method: decision.method, evidence: decision.evidence, sources }
    };
  }
  return { schema: policy.id, gameId: game.gameId, away: game.away, home: game.home,
    scheduledAt: game.scheduledAt, referenceAt: game.referenceAt, observations };
}

function matchesCapture(manifest, capture) {
  if (!manifest) return false;
  try {
    const linked = Object.fromEntries(Object.entries(manifest.observations).filter(([, row]) => row.provenance));
    if (!Object.hasOwn(linked, "schedule")) return false;
    const inputs = Object.fromEntries(Object.entries(linked).map(([key, row]) => [key, {
      dataThrough: row.dataThrough, method: row.provenance.method, evidence: row.provenance.evidence
    }]));
    const reproduced = prepare(capture.input, { captureSha256: capture.digest, inputs }, timestamp(capture.input.finishedAt));
    return canonical({ ...manifest, observations: linked }) === canonical(reproduced);
  } catch {
    return false;
  }
}

function pregameStatus(inputs, trust = {}) {
  const games = new Map();
  for (const input of inputs) {
    const signed = input?.manifest != null;
    const row = signed ? input.manifest : input?.game;
    if (!gameId(row?.gameId)) throw Error("Missing NHL Game ID for status report");
    const state = games.get(row.gameId) ?? { gameId: row.gameId };
    const key = signed ? "signed" : "capture";
    const value = sha256(input);
    if (state[key] && state[key].digest !== value) throw Error("Conflicting pregame records for " + row.gameId);
    state[key] = { digest: value, input };
    games.set(row.gameId, state);
  }
  const rows = [...games.values()].map(({ signed, capture }) => {
    const manifest = signed?.input.manifest;
    const checked = signed ? inspectSnapshot(signed.input, trust.snapshot ?? {}) : null;
    if (!capture && checked?.status === "rejected") throw Error("Invalid signed snapshot: " + checked.reason);
    const game = capture?.input.game ?? manifest;
    const diagnostic = capture ? inspectCapture(capture.input) : null;
    const accepted = checked && checked.status !== "rejected" && (!capture || matchesCapture(manifest, capture));
    const observations = accepted ? Object.entries(manifest.observations).map(([key, row]) => ({
      key, retrievedAt: row.retrievedAt, availableAt: row.availableAt
    })) : [];
    const sources = capture ? Object.entries(sourceUrls(game.gameDate, game)).map(([key]) => {
      const row = capture.input.sources[key];
      return { key, status: diagnostic.decoded[key] ? "ok" : row?.status === "ok" ? "unverified" : row?.status,
        retrievedAt: row?.retrievedAt ?? null, dataPublishedAt: null };
    }) : [];
    return { gameId: game.gameId, away: game.away, home: game.home, scheduledAt: game.scheduledAt,
      referenceAt: game.referenceAt, stage: accepted ? "signed" : capture?.input.mode ?? "rejected",
      status: "incomplete", legacyComplete: accepted && checked.status === "verified",
      missing: accepted ? checked.missing : required.slice(),
      observations, sources, candidates: Object.keys(diagnostic?.candidates ?? {}) };
  });
  return { schema: "banger-core-accuracy-pregame-v1", games: rows, models: availability,
    complete: 0,
    incomplete: rows.filter(row => row.status === "incomplete").length, comparablePredictions: 0 };
}

function read(file) {
  if (statSync(file).size > 24_000_000) throw Error("Input file too large");
  return JSON.parse(readFileSync(file, "utf8"));
}

async function main([command, ...args]) {
  if (command === "discover") {
    const result = await discover(args);
    console.log(JSON.stringify(result, null, 2));
    if (result.every(row => row.status !== "ok")) process.exitCode = 1;
  } else if (["capture", "probe"].includes(command) && args.length === 3) {
    const [date, id, output] = args;
    const result = await capture(date, id, command);
    writeArchive(result, output);
    console.log(JSON.stringify(pregameStatus([result]), null, 2));
  } else if (command === "prepare" && args.length === 3) {
    const [input, review, output] = args;
    const result = prepare(read(input), read(review));
    writeArchive(result, output);
    console.log(JSON.stringify({ sha256: sha256(result), missing: required.filter(key => !Object.hasOwn(result.observations, key)) }));
  } else if (command === "status" && args.length >= 3) {
    const [trust, output, ...inputs] = args;
    writeArchive(pregameStatus(inputs.map(read), trust === "-" ? {} : read(trust)), output);
  } else {
    throw Error("Usage: pregame.cjs discover DATE... | capture|probe DATE GAME_ID OUT | prepare CAPTURE REVIEW OUT | status TRUST-or-- OUT INPUT...");
  }
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { discover, capture, inspectCapture, prepare, pregameStatus, fetchSource, readSource };
