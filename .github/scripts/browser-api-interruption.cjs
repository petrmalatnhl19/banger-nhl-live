"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const feed = "**/functions/v1/nhl-feed?kind=skaters*";
  let mode = "abort";
  let requests = 0;
  try {
    await page.route(feed, async route => {
      requests++;
      if (mode === "abort") return route.abort("failed");
      if (mode === "timeout") {
        // Hold the HTTP request past the application's 12-second AbortSignal timeout.
        await new Promise(resolve => setTimeout(resolve, 15000));
        return route.abort("timedout").catch(() => {});
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ playerId: 999999, skaterFullName: "Test Player", teamAbbrevs: "DAL", points: 1, goals: 1, assists: 0, gamesPlayed: 1 }], total: 1 })
      });
    });
    const response = await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(response?.ok(), "app entrypoint must load");

    const openStats = async () => {
      await page.locator('#uxMobileNav [data-ux-tab="skaters"]').click();
      await page.waitForFunction(() => S.tab === "skaters", null, { timeout: 5000 });
    };
    const expectFailure = async (pattern, timeout) => {
      await page.waitForFunction(() => document.getElementById("status").textContent === "Načítání statistik selhalo", null, { timeout });
      assert.match(await page.locator("#content").innerText(), pattern);
      assert.equal(await page.locator('#uxMobileNav [data-ux-tab="skaters"]').getAttribute("aria-current"), "page");
    };

    await openStats();
    await expectFailure(/Nepodařilo se načíst celý žebříček/, 8000);
    assert(requests > 0, "disconnected request must be attempted");

    mode = "timeout";
    await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
    await openStats();
    await expectFailure(/NHL feed timeout \(12 s\)/, 18000);

    mode = "recover";
    await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
    await openStats();
    await page.waitForFunction(() => S.tab === "skaters" && S.rows.length === 1 && document.getElementById("status").textContent === "", null, { timeout: 8000 });
    assert.match(await page.locator("#content").innerText(), /Test Player/);
    assert(requests >= 3, "recovery must issue a fresh request after failures");
    console.log("STAB-05.7 API abort, 12-second timeout, and recovery passed");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
