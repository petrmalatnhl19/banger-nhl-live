'use strict';

const assert = require('node:assert/strict');
const {chromium, devices} = require('playwright');
const {event, shooter, feed} = require('./voice-08-fixture.cjs');

(async () => {
    const browser = await chromium.launch({headless: true});
    try {
        const page = await browser.newPage({...devices['Pixel 7']});
        page.setDefaultTimeout(10000);
        const unexpectedRequests = [];
        const errors = [];
        page.on('request', req => {
            if (/neural-match-voice|supertonic|onnx|voice-0[47]-test|match-voice\.worker/i.test(req.url())) unexpectedRequests.push(req.url());
        });
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            const candidates = [{name: 'Remote Czech', voiceURI: 'remote', lang: 'cs-CZ', localService: false}];
            const localVoice = {name: 'Čeština', voiceURI: 'local-cs', lang: 'cs-CZ', localService: true};
            const spoken = [];
            const engine = new EventTarget();
            let current = null;
            let canceled = null;
            let overlap = 0;
            Object.assign(engine, {
                getVoices: () => candidates.slice(),
                speak(utterance) {
                    if (current) overlap++;
                    current = utterance;
                    spoken.push({text: utterance.text, pitch: utterance.pitch, rate: utterance.rate, voice: utterance.voice?.voiceURI});
                    utterance.onstart?.();
                },
                cancel() { canceled = current || canceled; current = null; },
            });
            Object.defineProperty(window, 'speechSynthesis', {value: engine});
            Object.defineProperty(window, 'SpeechSynthesisUtterance', {value: class {
                constructor(text) { this.text = text; }
            }});
            window.testVoice = {
                spoken,
                addVoice: () => { candidates.push(localVoice); engine.dispatchEvent(new Event('voiceschanged')); },
                end: () => { const utterance = current; current = null; utterance?.onend(); },
                lateEnd: () => canceled?.onend(),
                playing: () => Boolean(current),
                overlap: () => overlap,
            };
        });

        const plays = [event(1, 'period-start', '00:00'), event(2, 'shot-on-goal', '02:00', shooter)];
        let live = feed(plays);
        const id = live.id;
        await page.route('**/functions/v1/nhl-feed?*', route => {
            const kind = new URL(route.request().url()).searchParams.get('kind');
            const data = kind === 'playbyplay' ? live : kind === 'game' ? {...live, summary: {scoring: []}} : {games: []};
            return route.fulfill({json: data});
        });
        const response = await page.goto('http://127.0.0.1:8765/', {waitUntil: 'domcontentloaded'});
        assert.ok(response?.ok());
        await page.evaluate(id => { void detail(id, document.createElement('button')); }, id);
        await page.locator('[data-match-tab="commentary"]').click();
        const button = name => page.locator('#commentaryFeed [data-bv="' + name + '"]');
        await button('start').waitFor();
        assert.ok(await button('start').isDisabled(), 'remote Czech voice alone must not enable playback');
        await page.evaluate(() => testVoice.addVoice());
        await page.locator('.bv-advanced > summary').click();
        await button('preview').click();
        assert.match(await page.evaluate(() => testVoice.spoken.at(-1).text), /Konor Mekdejvid/);
        assert.ok(await button('start').isDisabled(), 'unlabeled voice still needs listener confirmation');
        await button('confirm').click();
        assert.equal(await button('start').isEnabled(), true);
        await page.locator('.bv-advanced > summary').click();
        await button('pick-live').click();
        await button('start').click();
        assert.match(await page.evaluate(() => testVoice.spoken.at(-1).text), /U mikrofonu/);

        // New official events arrive while the opening summary is still being read.
        const goal = event(5, 'goal', '02:24', {
            eventOwnerTeamId: 22, scoringPlayerId: 1, awayScore: 1, homeScore: 0, assist1PlayerId: 3,
        });
        live = feed([...plays, event(3, 'shot-on-goal', '02:21', shooter), event(4, 'missed-shot', '02:23', shooter), goal],
            {awayTeam: {...live.awayTeam, score: 1}});
        await page.locator('#commentaryRefresh').click();
        await page.waitForFunction(() => testVoice.spoken.at(-1)?.text === 'Góóól!');
        await page.evaluate(() => testVoice.lateEnd());
        assert.equal(await page.evaluate(() => testVoice.spoken.length), 3, 'a canceled callback must not advance active goal playback');
        assert.equal(await page.evaluate(() => testVoice.spoken.at(-1).voice), 'local-cs');
        await page.evaluate(() => testVoice.end());
        await page.waitForFunction(() => /do vedení/.test(testVoice.spoken.at(-1)?.text));
        await page.evaluate(() => testVoice.end());
        await page.waitForFunction(() => !testVoice.playing());
        const liveCount = await page.evaluate(() => testVoice.spoken.length);
        await page.locator('#commentaryRefresh').click();
        await page.waitForTimeout(350);
        assert.equal(await page.evaluate(() => testVoice.spoken.length), liveCount, 'repeat polls cannot replay old events');

        await button('pick-replay').click();
        await button('start').click();
        assert.match(await page.evaluate(() => testVoice.spoken.at(-1).text), /Začíná první třetina/);
        await button('pause').click();
        assert.equal(await page.evaluate(() => testVoice.playing()), false);
        await page.evaluate(() => testVoice.lateEnd());
        await button('pause').click();
        assert.match(await page.evaluate(() => testVoice.spoken.at(-1).text), /Začíná první třetina/);
        await button('stop').click();
        assert.equal(await page.evaluate(() => testVoice.playing()), false);
        await button('start').click();
        await page.locator('#closeArena').click();
        assert.equal(await page.evaluate(() => testVoice.playing()), false);
        assert.equal(await page.evaluate(() => testVoice.overlap()), 0);
        assert.deepEqual(unexpectedRequests, []);
        assert.deepEqual(errors, []);
        console.log('VOICE-08 Chromium passed: actual match flow, local voice, live/replay, priorities and cleanup');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
