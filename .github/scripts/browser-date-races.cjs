"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

// Mobile date-navigation race: old API responses must never overwrite the newest day.
const dates = ["2026-11-14", "2026-11-15", "2026-11-16"];
const game = (id, time) => ({
  id, startTimeUTC: time, gameState: "FINAL",
  awayTeam: { abbrev: "DAL", score: 2 },
  homeTeam: { abbrev: "BOS", score: 1 },
  periodDescriptor: { number: 3 }
});
const fixtures = {
  "2026-11-14": [game(8101, "2026-11-14T20:00:00Z")],
  "2026-11-15": [game(8201, "2026-11-15T20:00:00Z")],
  // Intentionally unsorted response to verify final card order.
  "2026-11-16": [
    game(8303, "2026-11-16T23:00:00Z"),
    game(8301, "2026-11-16T19:00:00Z"),
    game(8302, "2026-11-16T21:00:00Z")
  ]
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "Europe/Prague"
  });
  const page = await context.newPage();
  const pending = new Map();
  const requests = [];
  let release = () => {};
  try {
    await page.clock.install({ time: new Date("2026-11-14T12:00:00Z") });
    await page.route("**/functions/v1/nhl-feed?kind=score*", async route => {
      const date = new URL(route.request().url()).searchParams.get("date");
      requests.push(date);
      if (!dates.includes(date)) {
        return route.fulfill({ status: 200, contentType: "application/json", body: '{"games":[]}' });
      }
      if (date !== dates[2]) {
        await new Promise(resolve => pending.set(date, resolve));
      }
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ games: fixtures[date] })
      }).catch(() => {});
    });
    const response = await page.goto("http://127.0.0.1:8765/", {
      waitUntil: "domcontentloaded", timeout: 30000
    });
    assert(response?.ok(), "application entrypoint must load");
    const selectDay = async date => {
      await page.locator("#date").fill(date);
      await page.locator("#date").dispatchEvent("change");
      await page.waitForFunction(expected => S.date === expected, date);
    };
    const ids = () => page.locator("#content .grid > article").evaluateAll(
      nodes => nodes.map(node => node.dataset.gameId)
    );

    await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
    await page.waitForFunction(() => S.tab === "games" && S.date === "2026-11-14");
    await page.waitForFunction(() => bangerGamesRequestId > 0);
    await page.waitForFunction(() => document.querySelector("#date")?.value === "2026-11-14");
    // Wait for the first request to reach the mocked server.
    await page.waitForFunction(() => document.getElementById("status").textContent.includes("Načítám zápasy"));
    await selectDay(dates[1]);
    await selectDay(dates[2]);
    await page.waitForFunction(() =>
      S.date === "2026-11-16" &&
      document.querySelectorAll("#content .grid > article").length === 3,
      null, { timeout: 10000 }
    );
    assert.deepEqual(await ids(), ["8301", "8302", "8303"]);
    assert.equal(await page.locator("#date").inputValue(), dates[2]);
    assert.equal(await page.locator("#content .grid > article").count(), 3);
    assert.equal(await page.locator("#status").innerText().then(s => s.startsWith("3 zápasů")), true);

    // Complete stale requests in reverse order. Neither may replace day 16.
    for (const date of [dates[1], dates[0]]) {
      await page.waitForFunction(d => true, date);
      assert(pending.has(date), "expected a delayed API request for " + date);
      pending.get(date)();
      pending.delete(date);
    }
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => S.date), dates[2]);
    assert.equal(await page.locator("#date").inputValue(), dates[2]);
    assert.deepEqual(await ids(), ["8301", "8302", "8303"], "stale response must not overwrite newest cards");
    assert.equal(await page.locator("#content .grid > article").count(), 3, "no duplicate cards");
    assert.equal(await page.locator("#status").innerText().then(s => s.startsWith("3 zápasů")), true);
    assert(dates.every(date => requests.includes(date)), "all three dates must reach the NHL feed");
    console.log("STAB-05.11 rapid date switching and out-of-order API responses passed");
  } finally {
    for (const resolve of pending.values()) resolve();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
