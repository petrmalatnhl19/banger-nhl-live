"use strict";

const { readFileSync } = require("node:fs");
const { timestamp } = require("./engine.js");
const { sha256 } = require("./reference.cjs");
const { writeArchive } = require("./snapshot.cjs");
const { fetchSource, readSource } = require("./pregame.cjs");
const { inspectPlayers, status, newsArticle, normalized } = require("./players.cjs");

const schema = "banger-accuracy-absence-evidence-v1";
const NHL = "https://api-web.nhle.com/v1/";
const search = name => {
  const surname = name.trim().split(/\s+/).at(-1);
  return "https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50&q=" + encodeURIComponent(surname);
};
const landing = id => NHL + "player/" + id + "/landing";
const words = value => value.normalize("NFD").toLowerCase().replace(/\p{M}/gu, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const playerId = id => /^[1-9]\d{6}$/.test(String(id));

function expected(playerBundle, item) {
  const { game, unavailable } = inspectPlayers(playerBundle);
  if (typeof item?.name !== "string" || item.name.length > 80 || !/^[A-Z]{3}$/.test(item.team)) throw Error("Invalid absence identity");
  const match = unavailable.filter(row => row.group === "absences" && row.team === item.team
    && normalized(row.name) === normalized(item.name));
  const club = Object.values(game.teams).find(entry => entry.team === item.team);
  if (match.length !== 1 || !club) throw Error("Absence was not uniquely listed in the selected NHL preview");
  const prefix = "https://www.nhl.com/" + normalized(club.nickname) + "/news/";
  if (typeof item.transaction !== "string" || !item.transaction.startsWith(prefix)
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.transaction.slice(prefix.length))) {
    throw Error("Use the canonical official club news URL");
  }
  return { game, candidate: match[0], searchUrl: search(item.name) };
}

function findId(data, name) {
  const matches = Array.isArray(data) ? data.filter(row => typeof row?.name === "string"
    && normalized(row.name) === normalized(name) && playerId(row.playerId)) : [];
  const ids = new Set(matches.map(row => Number(row.playerId)));
  return ids.size === 1 ? ids.values().next().value : null;
}

async function collect(playerBundle, config, { fetcher = fetch, now = Date.now } = {}) {
  if (!Array.isArray(config) || !config.length || config.length > 10) throw Error("Supply 1–10 supplemental absence entries");
  const planned = config.map(item => [item, expected(playerBundle, item)]);
  const keys = planned.map(([item]) => item.team + ":" + normalized(item.name));
  if (new Set(keys).size !== keys.length) throw Error("Duplicate absence entries");
  const entries = await Promise.all(planned.map(async ([item, game]) => {
    const [lookup, transaction] = await Promise.all([
      fetchSource(game.searchUrl, fetcher, now), fetchSource(item.transaction, fetcher, now, "html")
    ]);
    const id = findId(readSource(lookup, game.searchUrl), item.name);
    const profile = id ? await fetchSource(landing(id), fetcher, now) : null;
    return { item, lookup, transaction, profile };
  }));
  return { schema, playerBundle, playerBundleSha256: sha256(playerBundle), finishedAt: new Date(now()).toISOString(), entries };
}

function inspect(bundle) {
  if (bundle?.schema !== schema || !Array.isArray(bundle.entries) || bundle.entries.length < 1 || bundle.entries.length > 10
    || !Number.isFinite(timestamp(bundle.finishedAt)) || bundle.playerBundleSha256 !== sha256(bundle.playerBundle)) {
    throw Error("Invalid player source bundle");
  }
  const keys = new Set();
  return bundle.entries.map(entry => {
    const { item, lookup, transaction, profile } = entry;
    const { game, searchUrl } = expected(bundle.playerBundle, item);
    const key = item.team + ":" + normalized(item.name);
    if (keys.has(key)) throw Error("Duplicate absence entries");
    keys.add(key);
    const id = findId(readSource(lookup, searchUrl), item.name);
    const data = id == null ? null : readSource(profile, landing(id));
    const article = newsArticle(readSource(transaction, item.transaction, "html"), item.transaction);
    const bound = timestamp(bundle.finishedAt);
    const identity = data?.playerId === id && typeof data.firstName?.default === "string" && typeof data.lastName?.default === "string"
      && normalized(data.firstName.default + " " + data.lastName.default) === normalized(item.name)
      && timestamp(lookup.retrievedAt) <= timestamp(profile.retrievedAt) && timestamp(profile.retrievedAt) <= bound;
    const headline = article && " " + words(article.headline) + " ";
    const teamNews = headline && headline.includes(" " + words(item.name) + " ")
      && timestamp(article.dateModified) <= timestamp(transaction.retrievedAt) && timestamp(transaction.retrievedAt) <= bound;
    if (!identity || !teamNews) return { gameId: game.id, team: item.team, name: item.name, status: "unavailable",
      reason: !identity ? "nhl_identity_not_corroborated" : "official_transaction_unavailable" };
    const conflict = /\b(loan|loans|loaned|reassign|reassigns|reassigned|assigns|assigned)\b/i.test(article.headline);
    const record = (row, publishedAt = null, modifiedAt = null) => ({ source: row.url, retrievedAt: row.retrievedAt,
      publishedAt, modifiedAt, sha256: row.sha256 });
    return { gameId: game.id, team: item.team, playerId: id, name: item.name,
      status: conflict ? "assignment_conflict" : "identity_only", availableForSnapshot: false,
      beforeReference: [transaction, profile].every(row => timestamp(row.retrievedAt) <= timestamp(game.referenceAt)),
      evidence: { lookup: record(lookup), profile: record(profile),
        transaction: record(transaction, article.datePublished, article.dateModified) } };
  });
}

function report(bundle) {
  const output = status(bundle.playerBundle);
  output.games[0].players.supplemental = inspect(bundle);
  return output;
}

if (require.main === module) {
  const [command, first, second, third] = process.argv.slice(2);
  const read = file => JSON.parse(readFileSync(file, "utf8"));
  (async () => {
    if (command === "export" && third) writeArchive(await collect(read(first), read(second)), third);
    else if (command === "status" && second && !third) writeArchive(report(read(first)), second);
    else throw Error("Usage: absence-evidence.cjs export PLAYERS CONFIG OUTPUT | status INPUT OUTPUT");
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { collect, inspect, report };
