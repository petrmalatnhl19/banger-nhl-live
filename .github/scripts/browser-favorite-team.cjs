"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 530 }, isMobile: true, hasTouch: true });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        await page.route("https://fonts.googleapis.com/**", r => r.abort());
        await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
        const picker = page.locator("header.top .fan-team-picker");
        await picker.waitFor({ state: "attached" });
        const summary = picker.locator("summary");
        assert.match(await summary.innerText(), /Můj tým/);
        await summary.click();
        const select = picker.locator("select");
        await select.selectOption("DAL");
        assert.equal(await page.locator("body").getAttribute("data-fan-team"), "DAL");
        assert.match(await summary.innerText(), /Dallas Stars/);
        assert.equal(await page.evaluate(() => localStorage.getItem("banger-favorite-team-v1")), "DAL");
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--fan-accent").trim().toUpperCase()), "#8FCEAE");
        await page.reload({ waitUntil: "domcontentloaded" });
        assert.equal(await page.locator("body").getAttribute("data-fan-team"), "DAL");
        await picker.locator("summary").click();
        await picker.locator("select").selectOption("NYR");
        assert.equal(await page.locator("body").getAttribute("data-fan-team"), "NYR");
        await picker.locator("summary").click();
        await picker.locator("select").selectOption("");
        assert.equal(await page.locator("body").getAttribute("data-fan-team"), null);
        assert.equal(await page.evaluate(() => localStorage.getItem("banger-favorite-team-v1")), null);
        const pickerBounds = await picker.boundingBox();
        assert(pickerBounds && pickerBounds.x >= 0 && pickerBounds.x + pickerBounds.width <= width + 1, "Picker within viewport " + width);
        assert.deepEqual(errors, [], "No browser errors at " + width + "px");
        console.log("FAN-08 mobile favorite picker PASS:", width);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
