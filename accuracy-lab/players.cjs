"use strict";

const { readFileSync } = require("node:fs");
const { canonical, timestamp } = require("./engine.js");
const { availability, required, sha256 } = require("./reference.cjs");
const { fetchSource, readSource, inspectCapture } = require("./pregame.cjs");
const { writeArchive } = require("./snapshot.cjs");

const NHL = "https://api-web.nhle.com/v1/";
const SITE = "https://www.nhl.com/news/";
const teamSlugs = {
  ANA: "anaheim-ducks", BOS: "boston-bruins", BUF: "buffalo-sabres", CAR: "carolina-hurricanes",
  CBJ: "columbus-blue-jackets", CGY: "calgary-flames", CHI: "chicago-blackhawks", COL: "colorado-avalanche",
  DAL: "dallas-stars", DET: "detroit-red-wings", EDM: "edmonton-oilers", FLA: "florida-panthers",
  LAK: "los-angeles-kings", MIN: "minnesota-wild", MTL: "montreal-canadiens", NJD: "new-jersey-devils",
  NSH: "nashville-predators", NYI: "new-york-islanders", NYR: "new-york-rangers", OTT: "ottawa-senators",
  PHI: "philadelphia-flyers", PIT: "pittsburgh-penguins", SEA: "seattle-kraken", SJS: "san-jose-sharks",
  STL: "st-louis-blues", TBL: "tampa-bay-lightning", TOR: "toronto-maple-leafs", UTA: "utah-mammoth",
  VAN: "vancouver-canucks", VGK: "vegas-golden-knights", WPG: "winnipeg-jets", WSH: "washington-capitals"
};
const schema = "banger-accuracy-player-capture-v1";
const sides = ["away", "home"];
const groups = ["lineups", "absences"];
const iso = time => new Date(time).toISOString();
const hash = input => typeof input === "string" && /^[a-f\d]{64}$/.test(input);
const slug = text => text?.normalize("NFD").toLowerCase().replace(/\p{M}/gu, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normalized = name => slug(name)?.replaceAll("-", "");
const array = value => Array.isArray(value) ? value : [];

function identify(score, date, id) {
  const matching = array(score?.games).filter(row => String(row?.id) === id);
  const game = matching[0];
  if (matching.length !== 1 || game.gameDate !== date || game.gameType !== 2 || game.gameScheduleState !== "OK"
    || !["FUT", "PRE", "FINAL", "OFF", "LIVE", "CRIT"].includes(game.gameState)
    || !/^\d{8}$/.test(String(game.season)) || !Number.isFinite(timestamp(game.startTimeUTC))) throw Error("Unknown or invalid NHL game");
  const identity = Object.fromEntries(sides.map(side => {
    const team = game[side + "Team"];
    const nickname = team?.commonName?.default ?? team?.name?.default;
    if (!Object.hasOwn(teamSlugs, team?.abbrev) || typeof nickname !== "string" || !slug(nickname)) {
      throw Error("Missing official NHL team labels");
    }
    return [side, { team: team.abbrev, nickname, fullSlug: teamSlugs[team.abbrev] }];
  }));
  if (identity.away.team === identity.home.team) throw Error("Invalid NHL team identity");
  const day = new Date(date + "T00:00:00Z");
  const month = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(day).toLowerCase();
  const suffix = month + "-" + day.getUTCDate() + "-" + day.getUTCFullYear();
  return { id, date, season: String(game.season), teams: identity, scheduledAt: game.startTimeUTC, state: game.gameState,
    referenceAt: iso(timestamp(game.startTimeUTC) - 60 * 60_000),
    previewUrl: SITE + identity.away.fullSlug + "-" + identity.home.fullSlug + "-game-preview-" + suffix };
}

function publisher(html, game) {
  if (typeof html !== "string") return null;
  const canonicalUrls = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/gi)].map(item => item[1]);
  if (canonicalUrls.length !== 1 || canonicalUrls[0] !== game.previewUrl) return null;
  const articles = [];
  for (const match of html.matchAll(/<script\s+type="application\/ld(?:\+|&#x2B;|&#43;)json">([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "NewsArticle") articles.push(data);
    } catch {
      return null;
    }
  }
  if (articles.length !== 1) return null;
  const article = articles[0];
  const matchup = game.teams.away.nickname + " at " + game.teams.home.nickname + " ";
  if (typeof article.headline !== "string" || !["projected lineups", "confirmed lineups"].some(suffix =>
    article.headline?.toLowerCase() === (matchup + suffix).toLowerCase()) || typeof article.articleBody !== "string"
    || !Number.isFinite(timestamp(article.datePublished)) || !Number.isFinite(timestamp(article.dateModified))
    || timestamp(article.datePublished) > timestamp(article.dateModified)) return null;
  return article;
}

function parseSection(article, nickname) {
  const marker = text => /^\*\*.* (projected|confirmed) lineup\*\*$/i.test(text);
  const lines = article.articleBody.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const start = lines.map((line, index) => ({ line, index })).filter(({ line }) =>
    ["projected", "confirmed"].some(state => line.toLowerCase() === ("**" + nickname + " " + state + " lineup**").toLowerCase()));
  if (start.length !== 1) return null;
  const header = start[0];
  const state = / confirmed lineup\*\*$/i.test(header.line) ? "confirmed" : "projected";
  const entries = [];
  for (const line of lines.slice(header.index + 1)) {
    if (marker(line) || /status report|^#{1,6} /i.test(line)) break;
    entries.push(line);
  }
  const units = [];
  const listed = { scratched: null, injured: null };
  for (const line of entries) {
    const absence = /^\*{3}(Scratched|Injured):\*{2}\s*(.*?)\*$/i.exec(line);
    if (absence) {
      const kind = absence[1].toLowerCase();
      if (listed[kind] !== null) return null;
      listed[kind] = /^none\.?$/i.test(absence[2]) ? [] : absence[2].split(/,(?![^()]*\))/)
        .map(value => value.trim().replace(/\s+\([^()]*\)$/, ""));
    } else if (line.includes(" -- ") && Object.values(listed).every(value => value === null)) {
      units.push(line.split(" -- "));
    }
  }
  const lineupComplete = units.length === 7 && units.every((unit, i) => unit.length === (i < 4 ? 3 : 2));
  return { state, lineupComplete, lineups: units.flat(),
    absences: Object.entries(listed).flatMap(([reason, names]) => (names ?? []).map(name => ({ name, reason }))),
    absencesListed: Object.values(listed).every(value => value !== null) };
}

function rosterMatches(data) {
  const names = new Map();
  for (const row of ["forwards", "defensemen", "goalies"].flatMap(key => array(data?.[key]))) {
    if (!Number.isSafeInteger(row?.id) || !/^\d{7}$/.test(String(row.id))
      || typeof row.firstName?.default !== "string" || typeof row.lastName?.default !== "string") continue;
    const key = normalized(row.firstName.default + " " + row.lastName.default);
    if (!names.has(key)) names.set(key, new Set());
    names.get(key).add(row.id);
  }
  return names;
}

function inspectPlayers(bundle) {
  if (bundle?.schema !== schema || !["probe", "capture"].includes(bundle.mode) || !bundle.game
    || !bundle.sources || !Number.isFinite(timestamp(bundle.finishedAt))
    || !/^\d{4}-\d{2}-\d{2}$/.test(bundle.game.date) || !/^\d{10}$/.test(bundle.game.id)
    || (bundle.mode === "capture" && !hash(bundle.captureSha256))) throw Error("Invalid player capture");
  const scoreUrl = NHL + "score/" + bundle.game.date;
  const game = identify(readSource(bundle.sources.score, scoreUrl), bundle.game.date, bundle.game.id);
  if (canonical(game) !== canonical(bundle.game)) throw Error("Player capture conflicts with NHL Score");
  const preview = bundle.sources.preview;
  const article = publisher(readSource(preview, game.previewUrl, "html"), game);
  const cutoff = timestamp(game.referenceAt);
  const finished = timestamp(bundle.finishedAt);
  const published = timestamp(article?.datePublished);
  const modified = timestamp(article?.dateModified);
  const observed = timestamp(preview?.retrievedAt);
  const publisherValid = article && modified <= observed && observed <= finished;
  const open = cutoff - 15 * 60_000;
  const allTime = ["score", "preview", "awayRoster", "homeRoster"].every(key => {
    const row = bundle.sources[key];
    return row?.status === "ok" && timestamp(row.retrievedAt) >= open && timestamp(row.retrievedAt) <= finished;
  });
  const timely = Boolean(publisherValid && bundle.mode === "capture" && ["FUT", "PRE"].includes(game.state)
    && finished <= cutoff && published <= cutoff && modified <= cutoff && allTime);
  const records = [];
  const unavailable = [];
  const quality = {};
  for (const side of sides) {
    const { team, nickname } = game.teams[side];
    const section = publisherValid ? parseSection(article, nickname) : null;
    const roster = bundle.sources[side + "Roster"];
    const rosterTime = timestamp(roster?.retrievedAt);
    const names = rosterTime <= finished ? rosterMatches(readSource(roster, NHL + "roster/" + team + "/" + game.season)) : new Map();
    const start = records.length;
    for (const group of groups) {
      const slots = group === "lineups" ? section?.lineups.map(name => ({ name })) : section?.absences;
      for (const slot of slots ?? []) {
        const ids = names.get(normalized(slot.name));
        if (ids?.size !== 1) {
          unavailable.push({ team, group, name: slot.name, reason: "nhl_identity_unresolved_or_ambiguous" });
          continue;
        }
        records.push({ gameId: game.id, playerId: [...ids][0], team, group, status: section.state,
          ...(slot.reason && { reason: slot.reason }), source: game.previewUrl, retrievedAt: preview.retrievedAt,
          publishedAt: article.datePublished, modifiedAt: article.dateModified, sha256: preview.sha256,
          rosterRetrievedAt: roster.retrievedAt, rosterSha256: roster.sha256 });
      }
    }
    const own = records.slice(start);
    const identities = own.map(row => row.playerId);
    const unique = new Set(identities).size === identities.length;
    const anyMissing = group => unavailable.some(row => row.team === team && row.group === group);
    quality[side] = {
      status: section?.state ?? "unavailable",
      lineups: !!section?.lineupComplete && unique && !anyMissing("lineups"),
      absences: !!section?.absencesListed && unique && !anyMissing("absences") && names.size > 0
    };
  }
  if (new Set(records.map(row => row.playerId)).size !== records.length) {
    for (const side of sides) {
      quality[side].lineups = false;
      quality[side].absences = false;
    }
  }
  const missing = groups.filter(group => !sides.every(side => quality[side][group]));
  return { game, timely, quality, records, unavailable, missing,
    article: publisherValid ? { publishedAt: article.datePublished, modifiedAt: article.dateModified } : null };
}

async function collectPlayers(date, id, capture, { fetcher = fetch, now = Date.now } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp(date + "T00:00:00Z")) || !/^\d{10}$/.test(id)) {
    throw Error("Invalid NHL game date or ID");
  }
  const url = NHL + "score/" + date;
  if (capture && (!inspectCapture(capture).timely || capture.game.gameDate !== date || capture.game.gameId !== id)) {
    throw Error("Player collection requires an eligible capture for the same game");
  }
  const score = capture ? capture.sources.score : await fetchSource(url, fetcher, now);
  const game = identify(readSource(score, url), date, id);
  if (capture && now() >= timestamp(game.referenceAt)) throw Error("Player collection must start before T−60");
  const tasks = [["preview", game.previewUrl, "html"], ...sides.map(side =>
    [side + "Roster", NHL + "roster/" + game.teams[side].team + "/" + game.season, "json"])];
  const rows = await Promise.all(tasks.map(async ([key, source, format]) => [key, await fetchSource(source, fetcher, now, format)]));
  return { schema, mode: capture ? "capture" : "probe", game, finishedAt: iso(now()),
    ...(capture && { captureSha256: sha256(capture) }), sources: { score, ...Object.fromEntries(rows) } };
}

function status(bundle) {
  const result = inspectPlayers(bundle);
  const { game } = result;
  return { schema: "banger-core-accuracy-pregame-v1", complete: 0, incomplete: 1, comparablePredictions: 0,
    models: availability, games: [{ gameId: game.id, away: game.teams.away.team, home: game.teams.home.team,
      scheduledAt: game.scheduledAt, referenceAt: game.referenceAt, stage: bundle.mode, status: "incomplete",
      missing: required, candidates: groups.filter(group => !result.missing.includes(group)),
      observations: [], sources: [], players: { quality: result.quality, records: result.records,
        unavailable: result.unavailable, timely: result.timely } }] };
}

if (require.main === module) {
  const [command, date, id, output, rawCapture] = process.argv.slice(2);
  const read = file => JSON.parse(readFileSync(file, "utf8"));
  (async () => {
    if (command === "export" && output) {
      writeArchive(await collectPlayers(date, id, rawCapture ? read(rawCapture) : undefined), output);
    } else if (command === "status" && date && id) {
      writeArchive(status(read(date)), id);
    } else {
      throw Error("Usage: players.cjs export NHL_DATE GAME_ID OUTPUT [CAPTURE] | status INPUT OUTPUT");
    }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { collectPlayers, inspectPlayers, status };
