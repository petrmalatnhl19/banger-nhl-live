const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
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
  await page.locator('#closeArena').click();
  await page.locator('#liveArena.hidden').waitFor({ timeout: 10000 });
  if (errors.length) throw Error('JavaScript errors in match detail: ' + errors.join(' | '));
  if (errors.length) throw Error('JavaScript errors after navigation: ' + errors.join(' | '));
  // Verify all visible mobile navigation destinations without relying on hidden desktop tabs.
  await page.locator('#uxMobileNav [data-ux-tab="analyst"]').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('BANGER ANALYST'), { timeout: 10000 });
  await page.locator('#content .empty').waitFor({ timeout: 10000 });
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
