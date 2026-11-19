"use strict";

const assert = require("node:assert/strict");

const id = "2026020342", date = "2026-11-17";
const start = "2026-11-18T03:00:00Z", cutoff = Date.parse("2026-11-18T02:00:00Z");
const open = cutoff - 15 * 60000, at = cutoff - 10 * 60000;
const published = "2026-11-18T00:10:00Z";
const previewUrl = "https://www.nhl.com/news/dallas-stars-vegas-golden-knights-game-preview-november-17-2026";


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

module.exports = { fixture, id, date, start, cutoff, open, at, published, previewUrl };
