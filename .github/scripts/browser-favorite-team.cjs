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
        // FAN-10: verify the expanded picker is comfortably sized and stays on screen.
        const select = picker.locator("select");
        const modalLayout = await page.evaluate(() => {
          const el = document.querySelector("header.top .fan-team-picker select");
          const label = document.querySelector("header.top .fan-team-picker label");
          const r = el.getBoundingClientRect(), l = label.getBoundingClientRect();
          return { x:r.x, right:r.right, width:r.width, height:r.height,
            labelWidth:l.width, labelVisible:l.height > 0,
            position:getComputedStyle(el).position };
        });
        assert.equal(modalLayout.position, "fixed", "Expanded picker must be a modal-like overlay");
        assert(modalLayout.width >= width * 0.85, "Picker width at " + width);
        assert(modalLayout.height >= 48, "Picker touch height at " + width);
        assert(modalLayout.x >= -1 && modalLayout.right <= width + 1, "Expanded picker fits viewport at " + width);
        assert(modalLayout.labelVisible && modalLayout.labelWidth >= width * 0.85, "Picker heading visible at " + width);
        await select.selectOption("DAL");
        assert.equal(await page.locator("body").getAttribute("data-fan-team"), "DAL");
        assert.match(await summary.innerText(), /Dallas Stars/);
        assert.equal(await page.evaluate(() => localStorage.getItem("banger-favorite-team-v1")), "DAL");
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--fan-accent").trim().toUpperCase()), "#8FCEAE");
        const themed = await page.evaluate(() => {
          const header = document.querySelector("header.top");
          const css = getComputedStyle(header);
          return { border:css.borderBottomColor, background:css.backgroundImage };
        });
        assert.match(themed.background, /gradient/i, "Team-colored header gradient");
        assert.notEqual(themed.border, "rgba(0, 0, 0, 0)", "Team-colored header border");
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
