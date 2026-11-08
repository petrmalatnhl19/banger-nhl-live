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
    const data = kind === 'score' ? { games: [] } : kind === 'standings' ? { standings: [] } : { data: [], total: 0 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(pathToFileURL(path.resolve('index.html')).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('Dashboard · aktualizováno'), { timeout: 15000 });
  if (errors.length) throw Error('JavaScript errors on startup: ' + errors.join(' | '));
  await page.locator('#uxMobileNav [data-ux-tab="games"]').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('zápasů · aktualizováno'), { timeout: 10000 });
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
