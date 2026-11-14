"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8765/";
const AWAY = BASE + "stab-05-13-away.html";
const DAY = "2026-11-16";
const GAME_ID = 851316;
const fixture = (score) => ({ games: [{
  id: GAME_ID, startTimeUTC: "2026-11-16T21:00:00Z",
  gameState: score === 1 ? "LIVE" : "FINAL",
  awayTeam: { abbrev: "DAL", score },
  homeTeam: { abbrev: "BOS", score: 0 },
  periodDescriptor: { number: 3 }
}] });

(async () => {
  const browser = await chromium.launch({ headless: false, args: ["--enable-features=BackForwardCache"] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "Europe/Prague"
  });
  context.setDefaultTimeout(8000);
  context.setDefaultNavigationTimeout(8000);
  console.log("STAB-05.13: starting app history regression");
  const page = await context.newPage();
  const errors = [];
  let currentScore = 1;
  const requestedDates = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.route("**/functions/v1/nhl-feed?*", async route => {
      const url = new URL(route.request().url());
      const kind = url.searchParams.get("kind");
      if (kind === "score") {
        const date = url.searchParams.get("date");
        requestedDates.push(date);
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify(date === DAY ? fixture(currentScore) : { games: [] })
        });
      }
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ games: [], data: [], total: 0 })
      });
    });
    // A real top-level navigation to another same-origin document, not a tab
    // switch or a synthetic pageshow event.
    await page.route("**/stab-05-13-away.html", route => route.fulfill({
      status: 200, contentType: "text/html",
      body: '<!doctype html><title>Away page</title><h1 id="away">Away</h1>'
    }));
    const response = await page.goto(BASE, { waitUntil: "domcontentloaded" });
    assert(response?.ok(), "application must load");
    await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
    await page.waitForFunction(() => S.tab === "games");
    await page.locator("#date").fill(DAY);
    await page.locator("#date").dispatchEvent("change");
    await page.waitForFunction(day =>
      S.date === day &&
      document.querySelectorAll("#content .grid > article").length === 1 &&
      document.querySelector("#status")?.textContent.startsWith("1 zápasů"),
      DAY, { timeout: 10000 });
    assert.match(await page.locator("#content").innerText(), /DAL/);
    const initialCards = await page.locator("#content .grid > article").count();
    assert.equal(initialCards, 1);

    // Observe actual page lifecycle. A BFCache restore fires pageshow with
    // persisted=true. Keep the observation on the page across navigation.
    await page.evaluate(() => {
      window.__stab0513PageShows = [];
      window.addEventListener("pageshow", e =>
        window.__stab0513PageShows.push({ persisted: e.persisted }), false);
    });
    const initialRequestCount = requestedDates.filter(d => d === DAY).length;
    await page.goto(AWAY, { waitUntil: "load" });
    assert.equal(await page.locator("#away").innerText(), "Away");

    // The upstream feed changes while the user is away.
    currentScore = 4;
    console.log("STAB-05.13: application returning via history");
    await page.goBack({ waitUntil: "commit", timeout: 8000 });
    await page.waitForFunction(() => typeof S !== "undefined" && S.tab === "games", null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => S.date), DAY, "selected date must survive return");
    assert.equal(await page.locator("#date").inputValue(), DAY);
    assert.equal(await page.locator('#uxMobileNav [data-ux-tab="games"]').getAttribute("aria-current"), "page");
    assert.equal(await page.locator("#liveArena").evaluate(el => el.classList.contains("hidden")), true);

    const pageShows = await page.evaluate(() => window.__stab0513PageShows || []);
    const notRestoredReasons = await page.evaluate(() =>
      performance.getEntriesByType("navigation")[0]?.notRestoredReasons || null);
    console.log("STAB-05.13 BFCache notRestoredReasons:",
      JSON.stringify(notRestoredReasons));
    const navigation = await page.evaluate(() => ({
      entries: performance.getEntriesByType("navigation").map(e => ({ type: e.type, activationStart: e.activationStart })),
      pageshow: window.__stab0513PageShows || [],
      visibility: document.visibilityState
    }));
    console.log("STAB-05.13 BFCache diagnostics:", JSON.stringify(navigation));
    console.log("STAB-05.13 application BFCache restored:", pageShows.some(e => e.persisted === true));

    // A history return must show fresh scores whether it reloads or restores. App must refresh
    // its selected day's NHL data; merely retaining old cards is a regression.
    try {
      await page.waitForFunction(() =>
        document.querySelector('[data-game-score="851316"]')?.textContent.trim() === "4 : 0" &&
        !document.querySelector("#status")?.textContent.includes("Načítám"),
        null, { timeout: 10000 });
    } catch (error) {
      console.error("STAB-05.13 return diagnostics:", JSON.stringify({
        requestedDates, initialRequestCount, currentScore,
        state: await page.evaluate(() => ({tab:S.tab,date:S.date,status:document.querySelector("#status")?.textContent,content:document.querySelector("#content")?.textContent.slice(0,500)}))
      }));
      throw error;
    }
    assert(requestedDates.filter(d => d === DAY).length > initialRequestCount,
      "return must trigger a new score API request for the selected date");
    assert.equal(await page.locator("#content .grid > article").count(), 1,
      "return must not duplicate match cards");
    assert.equal(await page.locator("#date").inputValue(), DAY);
    assert.deepEqual(errors, [], "no uncaught browser errors");
    console.log("STAB-05.13 BFCache restore, selected tab/date, fresh scores and no stuck loading passed");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
