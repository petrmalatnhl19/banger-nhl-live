"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { chromium } = require("playwright");

const script = readFileSync("scripts/banger_tv_match_stats.js", "utf8");
const archive = [{
  game_id: 1, game_date: "2026-11-17", away_team: "DAL", home_team: "BOS",
  core42_away: 2.25, core42_home: 3.25
}];
const shadow = {
  core43_shadow_predictions_v1: [{ game_id: 1, core43_away: 1.25, core43_home: 2.5 }],
  core43_shadow_preview_v1: [{ game_id: 1, core43_preview_away: 2.75, core43_preview_home: 3.5, away_gsax_per100: 1.5, home_gsax_per100: 2.25 }]
};

async function check(restricted) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const paths = new Set();
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === "http://fixture.test" && url.pathname === "/") {
        return route.fulfill({ contentType: "text/html", body: '<div id="banger-prediction-hub"></div>' });
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        const name = url.pathname.split("/").at(-1);
        paths.add(name);
        const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        if (name === "nhl_prediction_archive") return route.fulfill({ json: archive, headers });
        if (Object.hasOwn(shadow, name)) {
          return restricted
            ? route.fulfill({ status: 403, json: { code: "42501" }, headers })
            : route.fulfill({ json: shadow[name], headers });
        }
      }
      if (url.pathname.startsWith("/v1/club-schedule-season/")) {
        return route.fulfill({ json: { games: [] }, headers: { "access-control-allow-origin": "*" } });
      }
      return route.abort();
    });

    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://fixture.test/");
    await page.addScriptTag({ content: script });
    await page.locator("#banger-tv-stats summary").click();
    const table = page.locator("#banger-tv-table");
    await table.getByText("CORE 4.2 · góly", { exact: true }).waitFor();
    async function values(label) {
      const row = table.getByRole("row").filter({ has: page.getByText(label, { exact: true }) });
      const cells = await row.getByRole("cell").allTextContents();
      return [cells[0], cells[2]];
    }
    assert.deepEqual(await values("CORE 4.2 · góly"), ["2,25", "3,25"]);
    assert.deepEqual(await values("CORE 4.3 · ověřený"), restricted ? ["—", "—"] : ["1,25", "2,50"]);
    assert.deepEqual(await values("CORE 4.3 · náhled"), restricted ? ["—", "—"] : ["2,75", "3,50"]);
    assert.deepEqual(await values("GSAx / 100 · vstup"), restricted ? ["—", "—"] : ["1,50", "2,25"]);
    assert.deepEqual([...paths].sort(), [...Object.keys(shadow), "nhl_prediction_archive"].sort());
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

(async () => {
  await check(false);
  await check(true);
  console.log("PASS SECURITY-88 TV Match Stats preserves CORE 4.2 while private CORE 4.3 values disappear");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
