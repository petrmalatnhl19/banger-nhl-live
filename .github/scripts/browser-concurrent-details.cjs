"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const game = (id, name) => ({
  id, gameState: "FINAL", gameType: 2,
  awayTeam: { abbrev: name, score: 2 },
  homeTeam: { abbrev: "BOS", score: 1 },
  summary: { scoring: [] },
  periodDescriptor: { number: 3 }
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const counts = { "71001": 0, "71002": 0, "71003": 0 };
  let releaseA;
  let startedA;
  const aStarted = new Promise(resolve => { startedA = resolve; });
  const aGate = new Promise(resolve => { releaseA = resolve; });
  try {
    await page.route("**/functions/v1/nhl-feed?*", async route => {
      const u = new URL(route.request().url());
      if (u.searchParams.get("kind") !== "game") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ games: [] }) });
      }
      const id = u.searchParams.get("id");
      if (!(id in counts)) return route.abort("failed");
      counts[id]++;
      if (id === "71001") {
        startedA();
        await aGate;
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(game(Number(id), id === "71001" ? "DAL" : id === "71002" ? "NYR" : "UTA")) }).catch(() => {});
    });
    const response = await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
    assert(response?.ok(), "application entrypoint must load");

    // Two concurrent reads of the same game must share exactly one in-flight fetch.
    await page.evaluate(() => {
      const url = "https://api-web.nhle.com/v1/gamecenter/71001/landing";
      window.__concurrent = Promise.all([get(url), get(url)]);
    });
    await aStarted;
    await page.waitForFunction(() => bangerNhlFeedInflight.size > 0, null, { timeout: 5000 });
    assert.equal(counts["71001"], 1, "two identical concurrent requests must deduplicate");

    // While A is delayed, B must render. Late A must never overwrite B.
    await page.evaluate(() => detail(71001, ""));
    await page.evaluate(() => detail(71002, ""));
    await page.waitForFunction(() => String(bangerActiveDetailGameId) === "71002" && !document.getElementById("arenaBody").textContent.includes("Načítám detail"), null, { timeout: 10000 });
    assert.equal(counts["71002"], 1, "second match must be fetched once");
    releaseA();
    await page.evaluate(() => window.__concurrent);
    await wait(150);
    assert.equal(await page.evaluate(() => String(bangerActiveDetailGameId)), "71002", "late A cannot replace active B");
    assert.match(await page.locator("#arenaBody").innerText(), /NYR/);
    assert.doesNotMatch(await page.locator("#arenaBody").innerText(), /DAL/);
    assert.equal(counts["71001"], 1, "detail of A must reuse the existing in-flight request");

    // Closing a detail while its request is pending must not leave a spinner.
    await page.evaluate(() => closeArena(true));
    await page.evaluate(() => detail(71003, ""));
    await page.waitForFunction(() => String(bangerActiveDetailGameId) === "71003", null, { timeout: 5000 });
    await page.evaluate(() => closeArena(true));
    await wait(150);
    assert.equal(await page.locator("#liveArena").evaluate(el => el.classList.contains("hidden")), true);
    assert.equal(await page.evaluate(() => bangerActiveDetailGameId), null);
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("ux-arena-open")), false);
    await page.waitForFunction(() => bangerNhlFeedInflight.size === 0, null, { timeout: 5000 });
    console.log("STAB-05.10 concurrent requests, stale detail and close cleanup passed");
  } finally {
    releaseA?.();
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
