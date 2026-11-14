"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const date = "2026-11-14";
const game = {
  id: 2026020100,
  season: 20262027,
  gameDate: date,
  startTimeUTC: date + "T22:00:00Z",
  gameState: "FUT",
  awayTeam: { abbrev: "DAL" },
  homeTeam: { abbrev: "COL" }
};
const standings = ["DAL", "COL"].map(code => ({
  teamAbbrev: { default: code }, gamesPlayed: 17, points: 24, goalFor: 54, goalAgainst: 43
}));

async function check(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: 530 }, isMobile: true, hasTouch: true,
    timezoneId: "Europe/Prague", reducedMotion: "reduce"
  });
  try {
    const page = await context.newPage();
    let failScores = false;
    let failDetail = false;
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date(date + "T18:00:00Z"));
    await page.route("https://fonts.googleapis.com/**", route => route.abort());
    await page.route("https://assets.nhle.com/**", route => route.abort());
    await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
    await page.route("**/v1/club-schedule-season/**", route => route.fulfill({ json: { games: [] } }));
    await page.route("**/functions/v1/nhl-feed?**", route => {
      const params = new URL(route.request().url()).searchParams;
      const kind = params.get("kind");
      if ((kind === "score" && failScores) || (kind === "game" && failDetail)) {
        return route.fulfill({ status: 503, json: {} });
      }
      const data = kind === "score" ? { games: params.get("date") === date ? [game] : [] }
        : kind === "game" ? game
        : kind === "standings" ? { standings }
        : { data: [], total: 0, games: [] };
      return route.fulfill({ json: data });
    });
    await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
    await page.locator("#dashRefresh").waitFor({ state: "attached" });
    const mobileNav = page.locator("#uxMobileNav");
    const analyst = mobileNav.getByRole("button", { name: "Analytika" });
    const trigger = page.locator(".analyst-list [data-analyze]").first();
    const dialog = page.getByRole("dialog", { name: "BANGER ANALYST PRO" });
    const close = dialog.getByRole("button", { name: "Zavřít" });
    failScores = true;
    await analyst.click();
    const listRetry = page.locator("#analyst-list-retry");
    await listRetry.waitFor();
    assert.match(await page.locator("#content").innerText(), /nepodařilo načíst/);
    failScores = false;
    await listRetry.click();
    await trigger.waitFor();
    await page.locator("#corePerformancePanel").waitFor();
    const bounds = await trigger.evaluate(button => ({
      bottom: button.getBoundingClientRect().bottom,
      navTop: document.querySelector("#uxMobileNav").getBoundingClientRect().top,
      pageWidth: document.documentElement.scrollWidth
    }));
    assert(bounds.bottom <= bounds.navTop, "first analysis action must be above the bottom navigation");
    assert.equal(bounds.pageWidth, width);
    assert.equal(await analyst.getAttribute("aria-current"), "page");

    failDetail = true;
    await trigger.click();
    await dialog.getByText("Detail zápasu není dostupný").waitFor();
    failDetail = false;
    await dialog.getByRole("button", { name: "Zkusit znovu" }).click();
    await dialog.locator(".analysis-match").waitFor();
    assert.equal(await close.evaluate(element => document.activeElement === element), true);
    assert.equal(await mobileNav.evaluate(element => !!element.closest("[inert]")), true);
    assert.equal(await mobileNav.isVisible(), false);
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);

    const report = dialog.locator('[data-ux-jump="report"]');
    await report.click();
    await dialog.locator(".analyst-expert-report[open]").waitFor();
    await page.waitForFunction(() => {
      const button = document.querySelector(".analysis-close");
      const bounds = button.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= innerHeight &&
        document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === button;
    });
    await close.click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await trigger.evaluate(button => document.activeElement === button), true);
    assert.equal(await mobileNav.isVisible(), true);

    await trigger.click();
    await dialog.locator(".analysis-match").waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await trigger.evaluate(button => document.activeElement === button), true);
    assert.deepEqual(errors, []);
    console.log(`PASS UX-04 Analytika ${width} × 530`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [360, 390, 430]) await check(browser, width);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
