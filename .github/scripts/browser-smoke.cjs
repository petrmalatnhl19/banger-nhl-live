const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const response = await page.goto('http://127.0.0.1:8765/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    if (!response || !response.ok()) throw new Error('HTML entrypoint did not load');
    await page.waitForTimeout(2500);
    const result = await page.evaluate(() => ({
      title: document.title,
      text: document.body?.innerText || '',
      visible: document.body && getComputedStyle(document.body).display !== 'none'
    }));
    if (!result.visible || !result.text.trim()) throw new Error('Application body is empty');
    if (!/BANGER|NHL/i.test(result.title + ' ' + result.text))
      throw new Error('Expected application branding is missing');
    if (errors.length) throw new Error('Browser JavaScript errors: ' + errors.join(' | '));
    console.log('Browser startup smoke test passed:', result.title);
  } finally {
    await page.screenshot({ path: '/tmp/banger-browser-smoke.png', fullPage: true }).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
