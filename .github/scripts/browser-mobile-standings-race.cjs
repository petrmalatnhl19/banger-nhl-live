"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 530 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        let releaseFirst;
        let markFirstStarted;
        const firstStarted = new Promise(resolve => { markFirstStarted = resolve; });
        const firstGate = new Promise(resolve => { releaseFirst = resolve; });
        let requests = 0;
        await page.route("https://fonts.googleapis.com/**", route => route.abort());
        await page.route("https://assets.nhle.com/**", route => route.abort());
        await page.route("**/functions/v1/nhl-feed?**", async route => {
          const query = new URL(route.request().url()).searchParams;
          if (query.get("kind") !== "standings" || query.has("team")) {
            return route.fulfill({ json: { games: [], data: [], standings: [] } });
          }
          const request = ++requests;
          if (request === 1) {
            markFirstStarted();
            await firstGate;
          }
          return route.fulfill({ json: { standings: [{
            teamAbbrev: { default: "DAL" },
            teamName: { default: "Dallas Stars" },
            conferenceAbbrev: "W", divisionAbbrev: "C",
            gamesPlayed: 20, points: request === 1 ? 11 : 99
          }] } });
        });
        await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
        await page.locator('#uxMobileNav [data-ux-tab="skaters"]').click();
        const tab = page.locator('#uxStatsHub [data-ux-tab="standings"]');
        await tab.click();
        await firstStarted;
        await page.locator('#uxStatsHub [data-ux-tab="teams"]').click();
        await tab.click();
        await page.getByText("99", { exact: true }).waitFor();
        const lateResponse = page.waitForResponse(response => response.url().endsWith("?kind=standings"));
        releaseFirst();
        await (await lateResponse).finished();
        await page.waitForLoadState("networkidle");
        assert.equal(await page.locator(".standings-points").first().textContent(), "99");
        console.log(`PASS UX-06 late standings response ${width} × 530`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
