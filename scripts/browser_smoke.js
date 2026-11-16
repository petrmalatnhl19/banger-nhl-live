const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  await page.addInitScript(() => {
    window.voiceTrace = [];
    window.AudioContext = class {
      resume() { window.voiceTrace.push('resume'); return Promise.resolve(); }
      suspend() { window.voiceTrace.push('pause'); return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createBuffer() { return { copyToChannel() {} }; }
      createBufferSource() {
        return { connect() {}, disconnect() {},
          start() { window.voiceTrace.push('audio:start'); },
          stop() { window.voiceTrace.push('audio:stop'); } };
      }
    };
    window.Worker = class {
      constructor() { window.voiceTrace.push('worker'); }
      addEventListener(type, callback) { if (type === 'message') this.message = callback; }
      postMessage(data) {
        if (data.type !== 'speak') return;
        window.voiceTrace.push(data.text);
        queueMicrotask(() => this.message({ data: {
          type: 'audio', id: data.id, rate: 44100, audio: new Float32Array([.1,.2,.1]),
        } }));
      }
      terminate() {}
    };
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://xxwqeiuyislnoxsmjuul.supabase.co/functions/v1/nhl-feed**', async route => {
    const kind = new URL(route.request().url()).searchParams.get('kind');
    const url = new URL(route.request().url());
    const data = kind === 'score'
      ? { games: [{ id: 2026020999, gameState: 'FUT', startTimeUTC: '2026-11-08T22:00:00Z',
          awayTeam: { abbrev: 'DAL', score: 0 }, homeTeam: { abbrev: 'BOS', score: 0 } }] }
      : kind === 'game'
        ? { id: 2026020999, gameState: 'FUT', awayTeam: { abbrev: 'DAL' }, homeTeam: { abbrev: 'BOS' }, summary: {} }
      : kind === 'boxscore'
        ? { id: 2026020999, playerByGameStats: { awayTeam: { forwards: [], defense: [], goalies: [] }, homeTeam: { forwards: [], defense: [], goalies: [] } } }
      : kind === 'playbyplay'
        ? { plays: [], rosterSpots: [], awayTeam: { id: 1, abbrev: 'DAL' }, homeTeam: { id: 2, abbrev: 'BOS' } }
      : kind === 'standings' ? { standings: [] } : { data: [], total: 0 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(pathToFileURL(path.resolve('index.html')).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('Dashboard · aktualizováno'), { timeout: 15000 });
  if (errors.length) throw Error('JavaScript errors on startup: ' + errors.join(' | '));
  await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('zápasů · aktualizováno'), { timeout: 10000 });
  await page.locator('#content [data-game]').first().click();
  await page.locator('#liveArena:not(.hidden) #closeArena').waitFor({ timeout: 10000 });
  await page.locator('#arenaBody [data-match-tab="lineups"]').first().click();
  await page.locator('#arenaBody [data-match-pane="lineups"]:not(.hidden)').waitFor({ timeout: 10000 });
  await page.locator('#matchMoreToggle').click();
  await page.locator('#matchMoreMenu:not(.hidden) [data-match-tab="players"]').click();
  await page.locator('#arenaBody [data-match-pane="players"]:not(.hidden)').waitFor({ timeout: 10000 });
  await page.locator('#arenaBody [data-match-tab="commentary"]').first().click();
  await page.locator('#arenaBody [data-match-pane="commentary"]:not(.hidden)').waitFor({ timeout: 10000 });
  const commentary = page.locator('#commentaryFeed');
  const panel = commentary.locator('.bv-panel');
  await panel.waitFor({ timeout: 10000 });
  assert.equal(await panel.locator('[data-bv=voice]').inputValue(), 'device');
  await panel.locator('summary[aria-label="Nastavení hlasu"]').click();
  await panel.locator('[data-bv=voice]').selectOption('spot');
  await panel.getByText(/400 MB/).waitFor();
  assert.deepEqual(await page.evaluate(() => window.voiceTrace), [], 'Voice assets must wait for Spustit');

  await commentary.evaluate(root => {
    root.innerHTML = '<p>Aktualizovaný komentář</p>';
    document.dispatchEvent(new CustomEvent('banger:commentary', { detail: {
      id: '2026020999', items: [{ id: 12, period: 1, time: '03:09', type: 'goal', text: 'GÓL! Dallas Stars vedou 2:1.' }],
    } }));
  });
  assert.equal(await panel.locator('[data-bv=voice]').inputValue(), 'spot');
  await panel.locator('summary[aria-label="Nastavení hlasu"]').click();
  await panel.locator('[data-bv=start]').click();
  await page.waitForFunction(() => window.voiceTrace.includes('audio:start'));
  assert.ok((await page.evaluate(() => window.voiceTrace)).includes('Gól! Dallas Stars vedou dva ku jedné.'));
  await panel.locator('[data-bv=pause]').click();
  await page.waitForFunction(() => window.voiceTrace.includes('pause'));

  await page.locator('#closeArena').click();
  await page.locator('#liveArena').waitFor({ state: 'hidden', timeout: 10000 });
  assert.ok((await page.evaluate(() => window.voiceTrace)).includes('audio:stop'), 'Closing the match must stop the voice');
  if (errors.length) throw Error('JavaScript errors in match detail: ' + errors.join(' | '));
  if (errors.length) throw Error('JavaScript errors after navigation: ' + errors.join(' | '));
  // Verify all visible mobile navigation destinations without relying on hidden desktop tabs.
  await page.locator('#uxMobileNav [data-ux-tab="analyst"]').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('BANGER ANALYST'), { timeout: 10000 });
  await page.locator('#content .analyst-list-card').first().waitFor({ timeout: 10000 });
  await page.locator('#uxMobileNav [data-ux-tab="skaters"]').click();
  await page.locator('#uxStatsHub:not(.hidden)').waitFor({ timeout: 10000 });
  await page.locator('#uxStatsHub [data-ux-tab="goalies"]').click();
  await page.waitForFunction(() => document.querySelector('#uxStatsHub [data-ux-tab="goalies"]')?.getAttribute('aria-pressed') === 'true', { timeout: 10000 });
  await page.locator('#uxMobileNav [data-ux-tab="dashboard"]').click();
  await page.waitForFunction(() => document.querySelector('#uxMobileNav [data-ux-tab="dashboard"]')?.getAttribute('aria-current') === 'page', { timeout: 10000 });
  if (errors.length) throw Error('JavaScript errors during mobile navigation: ' + errors.join(' | '));
  console.log('PASS: dashboard starts, mock NHL feed loads, games, analyst, player/goalie stats and dashboard navigation work without JavaScript errors.');
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
