"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const fixture = `
export function setRuntime() {}
export function loadVoiceStyle() { return {}; }
export async function loadTextToSpeech(directory, options, progress) {
    if (directory.includes('supertonic-3-quant')) {
        progress('Vocoder', 4, 4);
        await new Promise(resolve => setTimeout(resolve, 200));
        progress('Vocoder', 4, 4, { phase: 'ready', elapsedMs: 200 });
    } else {
        throw new Error('testovací chyba modelu');
    }
    return {
        textToSpeech: {
            sampleRate: 16000,
            async call() { return { wav: new Float32Array(1600).fill(0.3) }; },
        },
    };
}
export function writeWavFile() { throw new Error('Only the worker uses this fixture'); }
`;

(async () => {
    const browser = await chromium.launch({
        executablePath: process.env.BANGER_TEST_CHROMIUM || undefined,
    });
    try {
        const context = await browser.newContext({
            viewport: { width: 360, height: 690 }, isMobile: true, hasTouch: true,
        });
        const mime = 'text/javascript';
        let workers = 0;
        await context.route('**/ort.wasm.min.mjs', route => route.fulfill({
            contentType: mime, headers: { 'access-control-allow-origin': '*' }, body: 'export const env = { wasm: {} };',
        }));
        await context.route('**/match-voice.worker.mjs?**', async route => {
            workers++;
            const response = await route.fetch();
            const source = (await response.text()).replace("'./supertonic.mjs'", "'./supertonic-fixture.mjs'");
            await route.fulfill({ response, contentType: mime, body: source });
        });
        await context.route('**/supertonic-fixture.mjs', route => route.fulfill({ contentType: mime, body: fixture }));

        const page = await context.newPage();
        const clientErrors = [];
        page.on('pageerror', error => clientErrors.push(error.message));
        await page.goto('http://127.0.0.1:8765/voice-07-test.html');
        const status = page.getByRole('status');
        const generate = page.getByRole('button', { name: 'Vygenerovat ukázku' });
        const prepare = page.getByRole('button', { name: 'Načíst model' });
        const release = page.locator('#release');
        const clips = page.locator('#clips audio');
        const log = page.locator('#log');

        assert.equal(await page.locator('#delivery option').count(), 5);
        assert.equal(workers, 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
        await prepare.click();
        await status.filter({ hasText: /^Načtení modelu / }).waitFor();
        await page.locator('#delivery').selectOption('goal');
        await generate.click();
        await status.filter({ hasText: /^Syntéza / }).waitFor();
        await page.locator('#mode').selectOption('neutral');
        await page.locator('#steps').selectOption('4');
        await generate.click();
        await status.filter({ hasText: /^Syntéza / }).waitFor();
        assert.equal(workers, 1);
        assert.equal(await clips.count(), 2);
        assert.equal((await log.textContent()).match(/Model znovu použit/g).length, 2);
        await clips.first().evaluate(player => player.play());
        await page.waitForFunction(() => document.getElementById('log').textContent.includes('Přehráno · Gól'));

        await page.locator('#variant').selectOption('fp32');
        await generate.click();
        await status.filter({ hasText: /testovací chyba modelu/ }).waitFor();
        assert.equal(workers, 2);
        assert.equal(await clips.count(), 2);

        await page.locator('#variant').selectOption('fp16');
        await generate.click();
        await status.filter({ hasText: /Vocoder.*inicializace/ }).waitFor();
        await release.click();
        await status.filter({ hasText: /Test zastaven/ }).waitFor();
        await generate.click();
        await status.filter({ hasText: /^Syntéza / }).waitFor();
        assert.equal(workers, 4);
        assert.equal(await clips.count(), 2, 'a new render should replace only its matching clip');
        await release.click();
        await status.filter({ hasText: /Model a ukázky uvolněny/ }).waitFor();
        assert.equal(await clips.count(), 0);
        assert.deepEqual(clientErrors, []);
        console.log('VOICE-07 Chromium passed (mock ONNX inference, real worker and WAV playback)');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
