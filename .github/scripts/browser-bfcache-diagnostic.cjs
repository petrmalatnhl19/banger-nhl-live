"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:8765/";
(async () => {
 const browser = await chromium.launch({headless:false,args:["--enable-features=BackForwardCache"]});
 try {
  const context = await browser.newContext();
  context.setDefaultTimeout(8000);
  context.setDefaultNavigationTimeout(8000);
  const clean = await context.newPage();
  const cdp = await context.newCDPSession(clean);
  await cdp.send("Page.enable");
  cdp.on("Page.backForwardCacheNotUsed", event => console.log("STAB-05.13 CDP BFCache rejection:", JSON.stringify(event)));
  console.log("STAB-05.13: starting unmocked BFCache control");
  // Control experiment: real same-origin documents, no Playwright routing or API mocks.
  // If this fails, the CI Chromium environment itself cannot exercise BFCache.
  try {
    await clean.goto(BASE + ".github/fixtures/stab-bfcache-probe.html", { waitUntil: "load" });
    const identity = await clean.evaluate(() => window.__bfcacheProbe.identity);
    await clean.goto(BASE + ".github/fixtures/stab-bfcache-away.html", { waitUntil: "load" });
    console.log("STAB-05.13: control returning via history");
    await clean.goBack({ waitUntil: "commit", timeout: 8000 });
    await clean.waitForLoadState("domcontentloaded", { timeout: 8000 });
    const probe = await clean.evaluate(() => ({
      shows: window.__bfcacheProbe?.shows || [],
      identity: window.__bfcacheProbe?.identity,
      navigation: performance.getEntriesByType("navigation").map(e => ({
        type: e.type, notRestoredReasons: e.notRestoredReasons || null
      }))
    }));
    console.log("STAB-05.13 UNMOCKED BFCache control:", JSON.stringify(probe));
    assert(probe.shows.includes(true) && probe.identity === identity,
      "Unmocked BFCache control failed; Chromium runner cannot restore even simple static pages");
  } finally {
    await clean.close();
  }

 } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1});
