"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

// Deterministic browser regression for the actual production get() cache.
// Score list (not cached) shows LIVE -> FINAL; landing/boxscore caches expire.
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "Europe/Prague" });
  const page = await context.newPage();
  const gameId = 987654;
  const counters = { score: 0, game: 0, boxscore: 0 };
  let phase = "LIVE";
  const landing = () => ({
    id: gameId, gameState: phase,
    awayTeam: { abbrev: "DAL", score: phase === "LIVE" ? 1 : 2 },
    homeTeam: { abbrev: "BOS", score: 1 },
    summary: { scoring: [] }
  });
  const boxscore = () => ({
    gameState: phase,
    awayTeam: { abbrev: "DAL", score: phase === "LIVE" ? 1 : 2 },
    homeTeam: { abbrev: "BOS", score: 1 },
    playerByGameStats: { awayTeam: { forwards: [{ playerId: 1, name: { default: "Cache Test" }, goals: phase === "LIVE" ? 1 : 2 }] } }
  });
  const score = () => ({ games: [{
    id: gameId, startTimeUTC: "2026-11-14T23:00:00Z", gameState: phase,
    awayTeam: { abbrev: "DAL", score: phase === "LIVE" ? 1 : 2 },
    homeTeam: { abbrev: "BOS", score: 1 }
  }] });
  try {
    await page.clock.install({ time: new Date("2026-11-14T23:30:00Z") });
    await page.route("**/functions/v1/nhl-feed?*", async route => {
      const url = new URL(route.request().url());
      const kind = url.searchParams.get("kind");
      if (!Object.hasOwn(counters, kind)) return route.continue();
      counters[kind]++;
      const body = kind === "score" ? score() : kind === "game" ? landing() : boxscore();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    const response = await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(response?.ok(), "app must load");
    await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
    await page.waitForFunction(() => S.tab === "games" && document.querySelectorAll("#content .grid > article").length === 1, null, { timeout: 10000 });

    const read = async kind => page.evaluate(async ({ kind, id }) => {
      const url = kind === "game" ? "https://api-web.nhle.com/v1/gamecenter/" + id + "/landing" :
        "https://api-web.nhle.com/v1/gamecenter/" + id + "/boxscore";
      return get(url);
    }, { kind, id: gameId });
    const currentScore = () => page.evaluate(() => S.date);

    const liveLanding = await read("game");
    const liveStats = await read("boxscore");
    assert.equal(liveLanding.gameState, "LIVE");
    assert.equal(liveLanding.awayTeam.score, 1);
    assert.equal(liveStats.playerByGameStats.awayTeam.forwards[0].goals, 1);
    assert.deepEqual([counters.game, counters.boxscore], [1, 1]);

    phase = "FINAL";
    await page.evaluate(() => games());
    await page.waitForFunction(() => document.querySelector("#content .game-final") !== null, null, { timeout: 10000 });
    assert.equal(await currentScore(), "2026-11-15"); // fixed clock is 00:30 Prague
    assert.equal(await page.locator("#content .game-final").count(), 1, "score list must show FINAL");
    assert(counters.score >= 2, "score refresh must fetch the new phase");

    // Cached LIVE landing and boxscore remain available until their 8s TTL expires.
    assert.equal((await read("game")).gameState, "LIVE");
    assert.equal((await read("boxscore")).playerByGameStats.awayTeam.forwards[0].goals, 1);
    assert.deepEqual([counters.game, counters.boxscore], [1, 1], "cache hit must avoid duplicate API calls");

    await page.clock.fastForward(9000); // advance the installed browser clock by 9 seconds
    console.log("cache diagnostic", await page.evaluate(() => ({ now: Date.now(), entries: [...bangerGameDetailCache.entries()].map(([key, value]) => ({ kind: key.includes("kind=game&") ? "game" : "boxscore", expires: value.expires, phase: value.data.gameState })) })));
    const finalLanding = await read("game");
    const finalStats = await read("boxscore");
    assert.equal(finalLanding.gameState, "FINAL");
    assert.equal(finalLanding.awayTeam.score, 2);
    assert.equal(finalStats.playerByGameStats.awayTeam.forwards[0].goals, 2);
    assert.deepEqual([counters.game, counters.boxscore], [2, 2], "expired LIVE caches must refetch");

    // FINAL landing cache is 120s; boxscore with FINAL is also 120s by current TTL rules.
    await page.clock.fastForward(51000); // 60 seconds after initial cache creation
    assert.equal((await read("game")).gameState, "FINAL");
    assert.equal((await read("boxscore")).gameState, "FINAL");
    assert.deepEqual([counters.game, counters.boxscore], [2, 2], "FINAL cache must remain valid before 120s");

    await page.clock.fastForward(70000); // 130 seconds after initial cache creation
    await read("game");
    await read("boxscore");
    assert.deepEqual([counters.game, counters.boxscore], [3, 3], "FINAL cache must expire after 120s");
    console.log("STAB-05.9 LIVE to FINAL, scores, player stats and cache expiry passed");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
