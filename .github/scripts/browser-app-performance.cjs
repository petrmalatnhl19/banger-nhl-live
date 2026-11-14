"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 530 }, isMobile: true, hasTouch: true });
    const day = "2026-11-14";
    let score = 2;
    let failScores = false;
    let leaders = 0;
    let performanceRequests = 0;
    const requested = [];
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => requested.push(new URL(request.url()).pathname));
    await page.clock.setFixedTime(new Date(day + "T18:00:00Z"));
    await page.route("https://fonts.googleapis.com/**", route => route.abort());
    await page.route("https://assets.nhle.com/**", route => route.abort());
    await page.route("**/rest/v1/**", route => {
      if (route.request().url().includes("/nhl_core_model_accuracy?")) performanceRequests++;
      return route.fulfill({ json: [] });
    });
    await page.route("**/functions/v1/nhl-feed?**", async route => {
      const params = new URL(route.request().url()).searchParams;
      const kind = params.get("kind");
      if (kind === "score") {
        await new Promise(resolve => setTimeout(resolve, 145));
        if (failScores) return route.fulfill({ status: 503, json: {} });
        return route.fulfill({ json: { games: params.get("date") === day ? [{
          id: 2026020100, gameState: "LIVE", startTimeUTC: day + "T16:00:00Z",
          awayTeam: { abbrev: "DAL", score }, homeTeam: { abbrev: "COL", score: 0 }
        }] : [] } });
      }
      if (kind === "skaters") {
        leaders++;
        return route.fulfill({ json: { total: 1, data: [{
          playerId: 1, skaterFullName: "Jason Robertson", teamAbbrevs: "DAL", points: 30
        }] } });
      }
      return route.fulfill({ json: { standings: [] } });
    });

    const nav = tab => page.locator(`#uxMobileNav [data-ux-tab="${tab}"]`);
    const dashboardScore = page.locator(".dash-games-unified .dash-game-teams strong").first();
    const waitForScore = value => page.waitForFunction(expected =>
      document.querySelector(".dash-games-unified .dash-game-teams strong")?.textContent.trim().startsWith(expected), String(value));
    await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
    await waitForScore(2);
    await page.locator("#dashPlayerRows .dash-row").waitFor();
    assert(requested.includes("/splash-portrait.webp"));
    assert(!requested.some(path => /\/splash-.*\.png$/.test(path)));
    assert.equal(leaders, 1);

    await nav("analyst").click();
    const panel = page.locator("#corePerformancePanel");
    await panel.waitFor();
    const originalPanel = await panel.elementHandle();
    await page.locator(".analyst-list-card").first().waitFor();
    assert(await originalPanel.evaluate(element => element === document.getElementById("corePerformancePanel")));
    assert.equal(performanceRequests, 1);

    score = 4;
    await nav("dashboard").click();
    await waitForScore(4);
    await page.locator("#dashPlayerRows .dash-row").waitFor();
    assert.equal(leaders, 1, "return should reuse dashboard leaders");
    score = 5;
    await page.locator("#dashRefresh").click();
    await waitForScore(5);
    await page.locator("#dashPlayerRows .dash-row").waitFor();
    assert.equal(leaders, 2, "explicit refresh must reload leaders");

    failScores = true;
    await page.locator("#dashRefresh").click();
    await page.locator('.dash-games-unified [role="status"]').getByText("Některé výsledky NHL se nepodařilo načíst.").waitFor();
    assert.equal(await dashboardScore.count(), 0);
    assert.doesNotMatch(await page.locator("#status").innerText(), /aktualizováno/);
    assert.doesNotMatch(await page.locator(".dash-games-unified").innerText(), /nejsou naplánované/);
    failScores = false;
    score = 6;
    await page.locator("#dashRefresh").click();
    await waitForScore(6);
    assert.deepEqual(errors, []);
    console.log("PASS UX-05 asset, leaders cache, live refresh, API failure and Analyst deduplication");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
