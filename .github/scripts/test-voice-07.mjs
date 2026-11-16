import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveries, renderDelivery } from '../../voice/commentary-delivery.mjs';

function engineWith(wav = Array(100).fill(1)) {
    const calls = [];
    const engine = {
        style: {},
        textToSpeech: {
            sampleRate: 1000,
            async call(...args) {
                calls.push(args);
                return { wav };
            },
        },
    };
    return { calls, engine };
}

test('All five Czech profiles render on the same engine and voice', async () => {
    const { calls, engine } = engineWith();
    assert.deepEqual([...deliveries.keys()], ['play', 'danger', 'chance', 'goal', 'analysis']);
    for (const delivery of deliveries.keys()) {
        const { audio, rate } = await renderDelivery(engine, { delivery, mode: 'sport', steps: 8 }, () => {});
        assert.equal(rate, 1000);
        assert(audio.some(value => value > 0));
        assert(audio.every(value => Number.isFinite(value) && Math.abs(value) <= 0.981));
    }
    assert(calls.every(([, language, style, steps]) => language === 'cs' && style === engine.style && steps === 8));
});

test('Goal A/B keeps its wording but varies synthesis pace, silence and emphasis', async () => {
    const { calls, engine } = engineWith();
    const progress = [];
    const sport = await renderDelivery(engine, { delivery: 'goal', mode: 'sport', steps: 4 },
        (...args) => progress.push(args));
    const neutral = await renderDelivery(engine, { delivery: 'goal', mode: 'neutral', steps: 4 }, () => {});
    assert.deepEqual(progress, [[1, 3], [2, 3], [3, 3]]);
    assert.deepEqual(calls.slice(0, 3).map(([text]) => text), calls.slice(3).map(([text]) => text));
    assert.deepEqual(calls.map(call => call[4]), [1.12, 0.85, 1.10, 1.05, 1.05, 1.05]);
    assert(calls.every(call => call[3] === 4));
    assert.equal(sport.audio.length, 760);
    assert.equal(neutral.audio.length, 660);
    assert(sport.audio.slice(100, 280).every(value => value === 0));
    assert(sport.audio.slice(380, 660).every(value => value === 0));
    assert(sport.audio[300] > sport.audio[20]);
    assert.equal(neutral.audio[300], neutral.audio[20]);
});

test('Rejects invalid options, empty audio and non-finite samples', async () => {
    const settings = { delivery: 'goal', mode: 'sport', steps: 8 };
    const { engine } = engineWith();
    for (const invalid of [{ delivery: 'constructor' }, { steps: 0 }, { mode: 'other' }]) {
        await assert.rejects(renderDelivery(engine, { ...settings, ...invalid }, () => {}), /Neplatný profil/);
    }
    await assert.rejects(renderDelivery(engineWith([]).engine, settings, () => {}), /prázdný zvuk/);
    await assert.rejects(renderDelivery(engineWith([NaN]).engine, settings, () => {}), /neplatný vzorek/);
});
