const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const spotRequests = [];
  page.on('request', request => {
    if (/neural-match-voice|supertonic|onnx|match-voice\.worker|huggingface/i.test(request.url())) spotRequests.push(request.url());
  });
  await page.addInitScript(() => {
    try { localStorage.setItem('banger-commentary-voice', 'spot'); } catch (_) {}
    window.voiceTrace = [];
    const voice = {name: 'Čeština', lang: 'cs-CZ', localService: true};
    const synth = new EventTarget();
    Object.assign(synth, {
      speaking: false,
      paused: false,
      getVoices: () => [voice],
      speak(utterance) {
        this.speaking = true;
        window.voiceTrace.push({text: utterance.text, lang: utterance.lang, voice: utterance.voice?.name});
        utterance.onstart?.();
      },
      pause() { this.paused = true; window.voiceTrace.push('pause'); },
      resume() { this.paused = false; window.voiceTrace.push('resume'); },
      cancel() { this.speaking = this.paused = false; window.voiceTrace.push('cancel'); },
    });
    Object.defineProperty(window, 'speechSynthesis', {value: synth});
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {value: class {
      constructor(text) { this.text = text; }
    }});
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
  await panel.locator('summary[aria-label="Nastavení hlasu"]').click();
  assert.equal(await panel.locator('[data-bv=voice]').count(), 0);
  assert.equal(await panel.getByText(/hlas ze spotu|400 MB/i).count(), 0);
  assert.deepEqual(await page.evaluate(() => window.voiceTrace), [], 'Commentary waits for Spustit');

  await commentary.evaluate(root => {
    root.innerHTML = '<p>Aktualizovaný komentář</p>';
    document.dispatchEvent(new CustomEvent('banger:commentary', {detail: {
      id: '2026020999',
      items: [{id: 12, period: 1, time: '03:09', type: 'goal', text: 'GÓL! Jason Robertson skóruje.'}],
    }}));
  });
  assert.equal(await panel.locator('.bv-advanced').getAttribute('open'), '', 'Feed refresh preserves the settings panel');
  await panel.locator('summary[aria-label="Nastavení hlasu"]').click();
  await panel.locator('[data-bv=pick-live]').click();
  assert.equal(await panel.locator('[data-bv=pick-live]').getAttribute('aria-pressed'), 'true');
  await panel.locator('[data-bv=pick-replay]').click();
  await panel.locator('[data-bv=start]').click();
  assert.deepEqual(await page.evaluate(() => window.voiceTrace.at(-1)),
    {text: 'GÓL! Džejson Robertson skóruje.', lang: 'cs-CZ', voice: 'Čeština'});
  await panel.locator('[data-bv=pause]').click();
  await panel.locator('[data-bv=pause]').click();
  assert.deepEqual(await page.evaluate(() => window.voiceTrace.slice(-2)), ['pause', 'resume']);

  await page.locator('#closeArena').click();
  await page.locator('#liveArena').waitFor({state: 'hidden', timeout: 10000});
  assert.equal(await page.evaluate(() => window.voiceTrace.at(-1)), 'cancel');
  assert.deepEqual(spotRequests, []);
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
