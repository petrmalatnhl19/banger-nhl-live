"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8765/";
const DAY = "2026-11-16";
const GAME_ID = 851216;
const score = date => ({ games: date === DAY ? [{
  id: GAME_ID, startTimeUTC: "2026-11-16T21:00:00Z",
  gameState: "FINAL", awayTeam: { abbrev: "DAL", score: 3 },
  homeTeam: { abbrev: "BOS", score: 2 },
  periodDescriptor: { number: 3 }
}] : [] });
const landing = {
  id: GAME_ID, gameState: "FINAL", gameType: 2,
  awayTeam: { abbrev: "DAL", score: 3 },
  homeTeam: { abbrev: "BOS", score: 2 },
  summary: { scoring: [] }, periodDescriptor: { number: 3 }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "Europe/Prague"
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.clock.install({ time: new Date("2026-11-14T12:00:00Z") });
    await page.route("**/functions/v1/nhl-feed?*", async route => {
      const url = new URL(route.request().url());
      const kind = url.searchParams.get("kind");
      if (kind === "score") {
        const date = url.searchParams.get("date");
        requests.push(date);
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify(score(date))
        });
      }
      if (kind === "game" && url.searchParams.get("id") === String(GAME_ID)) {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify(landing)
        });
      }
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ games: [], data: [], total: 0 })
      });
    });
    const response = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(response?.ok(), "app must load");

    await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
    await page.waitForFunction(() => S.tab === "games" && history.state?.bangerTab === "games");
    await page.locator("#date").fill(DAY);
    await page.locator("#date").dispatchEvent("change");
    await page.waitForFunction(day =>
      S.date === day && document.querySelectorAll("#content .grid > article").length === 1,
      DAY, { timeout: 10000 });
    assert.equal(await page.locator("#date").inputValue(), DAY);

    // Modal creates a history entry. Browser Back should close it without
    // losing the selected games tab or date.
    await page.evaluate(id => { void detail(id, document.createElement("button")); }, GAME_ID);
    await page.waitForFunction(() =>
      history.state?.bangerModal === true &&
      !document.getElementById("liveArena").classList.contains("hidden") &&
      !document.getElementById("arenaBody").textContent.includes("Načítám detail"),
      null, { timeout: 10000 });
    assert.match(await page.locator("#arenaBody").innerText(), /DAL/);
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => document.getElementById("liveArena").classList.contains("hidden"));
    assert.equal(await page.evaluate(() => S.tab), "games");
    assert.equal(await page.evaluate(() => S.date), DAY);
    assert.equal(await page.locator("#date").inputValue(), DAY);
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("ux-arena-open")), false);

    // Tab history should restore the previous tab and then return to games.
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => S.tab === "dashboard" && history.state?.bangerTab === "dashboard", null, { timeout: 10000 });
    await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => S.tab === "games" && history.state?.bangerTab === "games", null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => S.date), DAY, "date must survive history Back/Forward");
    assert.equal(await page.locator("#date").inputValue(), DAY);
    assert.equal(await page.locator("#liveArena").evaluate(el => el.classList.contains("hidden")), true);

    // Reload must restore the selected tab and date without reopening a stale
    // match modal or leaving an indefinite loading indicator.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => S.tab === "games" && history.state?.bangerTab === "games", null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => S.date), DAY, "date must survive a page reload");
    assert.equal(await page.locator("#date").inputValue(), DAY);
    await page.waitForFunction(() =>
      document.querySelectorAll("#content .grid > article").length === 1 &&
      !document.getElementById("status").textContent.includes("Načítám"),
      null, { timeout: 10000 });
    assert.equal(await page.locator("#liveArena").evaluate(el => el.classList.contains("hidden")), true);
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("ux-arena-open")), false);
    assert(requests.includes(DAY), "the restored date must be requested from NHL feed");
    assert.deepEqual(errors, [], "no uncaught browser errors");
    console.log("STAB-05.12 history, selected date, modal cleanup and reload passed");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
