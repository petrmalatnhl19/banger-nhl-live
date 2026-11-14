"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

// Clock is fixed in Prague time. The feed is mocked, so the test is deterministic
// and never depends on real NHL games or external API availability.
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: "Europe/Prague"
  });
  const page = await context.newPage();
  const requests = [];
  const game = (id, startTimeUTC) => ({
    id, startTimeUTC, gameState: "FINAL",
    awayTeam: { abbrev: "DAL" }, homeTeam: { abbrev: "BOS" },
    periodDescriptor: { number: 3 }
  });
  try {
    await page.clock.install({ time: new Date("2026-11-14T22:59:00Z") }); // 23:59 CET
    await page.route("**/functions/v1/nhl-feed?kind=score*", async route => {
      const date = new URL(route.request().url()).searchParams.get("date");
      requests.push(date);
      const games = date === "2026-11-14" ? [
        game(5803, "2026-11-15T02:00:00Z"),
        game(5801, "2026-11-14T23:00:00Z"),
        game(5802, "2026-11-15T00:00:00Z")
      ] : date === "2026-11-15" ? [
        game(5902, "2026-11-16T02:00:00Z"),
        game(5901, "2026-11-15T23:00:00Z")
      ] : [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ games }) });
    });
    const response = await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(response?.ok(), "application must load");
    await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
    const ids = () => page.locator("#content .grid > article").evaluateAll(nodes => nodes.map(n => n.dataset.gameId));
    await page.waitForFunction(() => S.tab === "games" && S.date === "2026-11-14" && document.querySelectorAll("#content .grid > article").length === 3, null, { timeout: 10000 });
    assert.deepEqual(await ids(), ["5801", "5802", "5803"], "games must be sorted by start time, not API order");

    // Advance the wall clock over midnight without triggering unrelated periodic timers.
    await page.clock.setFixedTime(new Date("2026-11-14T23:01:00Z")); // 00:01 CET on Nov 15
    await page.evaluate(() => games()); // same refresh path as the 60s timer
    await page.waitForFunction(() => document.getElementById("status").textContent.includes("aktualizováno"), null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => S.date), "2026-11-14", "selected date must remain unchanged at midnight");
    assert.equal(await page.locator("#date").inputValue(), "2026-11-14");
    assert.deepEqual(await ids(), ["5801", "5802", "5803"], "order and cards must remain stable after midnight refresh");
    assert.equal(await page.locator("#content .grid > article").count(), 3, "no duplicate cards");

    // 'Today' must use the *new* Prague local date and fetch the new day's games.
    await page.locator("#today").click();
    await page.waitForFunction(() => S.date === "2026-11-15" && document.querySelectorAll("#content .grid > article").length === 2, null, { timeout: 10000 });
    assert.equal(await page.locator("#date").inputValue(), "2026-11-15");
    assert.deepEqual(await ids(), ["5901", "5902"], "new day's games must be ordered");
    assert(requests.includes("2026-11-14") && requests.includes("2026-11-15"), "both dates must be requested");
    console.log("STAB-05.8 Prague midnight, selected date, ordering and Today passed");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
