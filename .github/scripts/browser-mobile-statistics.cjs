"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const skaters = [
  { playerId: 1, skaterFullName: "Connor McDavid", teamAbbrevs: "EDM", points: 31, goals: 10, shots: 48 },
  { playerId: 2, skaterFullName: "David Pastrňák", teamAbbrevs: "BOS", points: 26, goals: 12, shots: 72 },
  { playerId: 3, skaterFullName: "Jason Robertson", teamAbbrevs: "DAL", points: 29, goals: 11, shots: 55 },
  { playerId: 4, skaterFullName: "Alexandre Carrier, obránce", teamAbbrevs: "NSH,MTL", points: 8, goals: 2, shots: 27 }
];
const goalies = [
  { playerId: 11, goalieFullName: "Jake Oettinger", teamAbbrevs: "DAL", wins: 11, goalsAgainstAverage: 2.4, savePctg: .925 },
  { playerId: 12, goalieFullName: "Igor Shesterkin", teamAbbrevs: "NYR", wins: 10, goalsAgainstAverage: 2.1, savePctg: 94 },
  { playerId: 13, goalieFullName: "Ilya Sorokin", teamAbbrevs: "NYI", wins: 7, goalsAgainstAverage: 3.1, savePctg: .914 },
  { playerId: 14, goalieFullName: "Lukáš Dostál", teamAbbrevs: "ANA", wins: 5, goalsAgainstAverage: null, savePctg: null }
];

async function testViewport(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: 530 },
    isMobile: true,
    hasTouch: true,
    timezoneId: "Europe/Prague"
  });
  try {
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    let failGoalies = true;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://fonts.googleapis.com/**", route => route.abort());
    await page.route("**/functions/v1/nhl-feed?**", async route => {
      const params = new URL(route.request().url()).searchParams;
      const kind = params.get("kind");
      const start = Number(params.get("start"));
      requests.push([kind, start]);
      if (kind === "goalies" && failGoalies) {
        await route.fulfill({ status: 503, json: {} });
      } else if (kind === "skaters") {
        await route.fulfill({ json: { total: 101, data: start ? skaters.slice(3) : skaters.slice(0, 3) } });
      } else if (kind === "goalies") {
        await route.fulfill({ json: { total: goalies.length, data: goalies } });
      } else {
        await route.fulfill({ json: { games: [], standings: [] } });
      }
    });
    const search = page.getByRole("textbox", { name: "Hledat hráče nebo tým" });
    const sort = page.locator("#sort");
    const table = page.locator(".stats-tablewrap");
    const column = key => table.locator(`[data-sort-key="${key}"]`);
    const category = key => page.locator(`#uxStatsHub [data-ux-tab="${key}"]`);
    const names = () => table.locator("tbody .playerlink").allTextContents();
    const response = await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
    assert(response?.ok());
    await page.locator("#dashRefresh").waitFor({ state: "attached" });
    const statsNav = page.locator('#uxMobileNav [data-ux-tab="skaters"]');
    await statsNav.click();
    await column("skaterFullName").waitFor();
    assert.deepEqual(await names(), ["Connor McDavid", "Jason Robertson", "David Pastrňák", "Alexandre Carrier, obránce"]);
    assert.equal(await statsNav.getAttribute("aria-current"), "page");
    assert.equal(await category("skaters").getAttribute("aria-pressed"), "true");

    const initialLayout = await table.evaluate(element => ({
      firstRowBottom: element.querySelector("tbody tr").getBoundingClientRect().bottom,
      navTop: document.querySelector("#uxMobileNav").getBoundingClientRect().top,
      width: document.documentElement.scrollWidth
    }));
    assert.equal(initialLayout.width, width);
    assert(initialLayout.firstRowBottom <= initialLayout.navTop, "first data row must be reachable above fixed navigation");

    await search.fill("pastrnak");
    assert.deepEqual(await names(), ["David Pastrňák"]);
    await search.fill("Montreal Canadiens");
    assert.deepEqual(await names(), ["Alexandre Carrier, obránce"], "search includes pages beyond the first and a traded player's second team");
    await search.fill("nenalezený hráč");
    await page.locator("#content").getByRole("status").getByText("Žádný hráč ani tým neodpovídá hledání.").waitFor();
    await search.fill("");
    await column("skaterFullName").click();
    assert.deepEqual(await names(), ["Alexandre Carrier, obránce", "Connor McDavid", "David Pastrňák", "Jason Robertson"]);
    await column("skaterFullName").click();
    assert.equal((await names())[0], "Jason Robertson");
    await sort.selectOption("goals");
    assert.equal((await names())[0], "David Pastrňák");

    const before = await table.evaluate(element => {
      element.scrollLeft = element.scrollWidth;
      return element.scrollLeft;
    });
    assert(before > 0, "wide tables must scroll inside the panel");
    await column("shots").click();
    assert.equal((await names())[0], "David Pastrňák");
    assert(await table.evaluate(element => element.scrollLeft) > 0, "sorting an off-screen column must preserve horizontal scroll");

    await category("goalies").click();
    const retry = page.getByRole("button", { name: "Zkusit znovu" });
    await retry.waitFor();
    failGoalies = false;
    await retry.click();
    await column("goalieFullName").waitFor();
    assert.equal(await category("goalies").getAttribute("aria-pressed"), "true");
    assert.equal(await statsNav.getAttribute("aria-current"), "page");
    assert.equal((await names())[0], "Jake Oettinger");
    await sort.selectOption("goalsAgainstAverage");
    assert.deepEqual(await names(), ["Igor Shesterkin", "Jake Oettinger", "Ilya Sorokin", "Lukáš Dostál"]);
    assert.equal(await column("goalsAgainstAverage").locator("..").getAttribute("aria-sort"), "ascending");
    await column("goalsAgainstAverage").click();
    assert.deepEqual(await names(), ["Ilya Sorokin", "Jake Oettinger", "Igor Shesterkin", "Lukáš Dostál"]);
    await sort.selectOption("savePctg");
    assert.equal((await names())[0], "Igor Shesterkin", "fraction and whole percentage must sort on the same scale");
    await search.fill("lukas dostal");
    assert.deepEqual(await names(), ["Lukáš Dostál"]);

    const loadedSkaterPages = requests.filter(([kind]) => kind === "skaters").length;
    await category("skaters").click();
    await column("skaterFullName").waitFor();
    assert.equal(await search.inputValue(), "");
    assert.equal((await names())[0], "Connor McDavid");
    assert.equal(requests.filter(([kind]) => kind === "skaters").length, loadedSkaterPages, "return reuses the complete ranking");
    await category("goalies").click();
    await column("goalieFullName").waitFor();
    assert.equal((await names())[0], "Jake Oettinger");
    assert.equal(requests.filter(([kind]) => kind === "goalies").length, 2);
    assert.deepEqual(errors, []);
    console.log(`PASS UX-03 Statistics ${width} × 530`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [360, 390, 430]) await testViewport(browser, width);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
