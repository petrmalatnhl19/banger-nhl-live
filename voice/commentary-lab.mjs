import { deliveries } from './commentary-delivery.mjs';
import { writeWavFile } from './supertonic.mjs';

const byId = id => document.getElementById(id);
const delivery = byId('delivery');
const mode = byId('mode');
const variant = byId('variant');
const steps = byId('steps');
const log = byId('log');
const clips = new Map();
const controls = [delivery, mode, variant, steps, byId('generate'), byId('prepare')];
const LOAD_LIMIT = 300_000;
const SYNTHESIS_LIMIT = 180_000;
const IDLE_LIMIT = 120_000;
const MAX_CLIPS = 10;
let worker;
let workerVariant;
let active;
let requestId = 0;
let deadline;
let idleTimer;

for (const [value, { label }] of deliveries) delivery.add(new Option(label, value));
delivery.addEventListener('change', updateSample);
updateSample();

function updateSample() {
    byId('sample').textContent = deliveries.get(delivery.value).phrases.map(([text]) => text).join(' ');
}

function seconds(ms) {
    return (ms / 1000).toFixed(2).replace('.', ',') + ' s';
}

function record(message) {
    log.textContent = (log.textContent + new Date().toLocaleTimeString('cs-CZ') + '  ' + message + '\n')
        .split('\n').slice(-201).join('\n');
    log.scrollTop = log.scrollHeight;
    byId('copy').disabled = false;
}

function status(message) {
    byId('status').textContent = message;
    record(message);
}

function refreshControls() {
    for (const control of controls) control.disabled = Boolean(active);
    const release = byId('release');
    release.disabled = !worker && clips.size === 0;
    release.textContent = active ? 'Zastavit a uvolnit model' : 'Uvolnit model a ukázky';
}

function dropWorker() {
    clearTimeout(deadline);
    clearTimeout(idleTimer);
    active = undefined;
    worker?.terminate();
    worker = undefined;
    workerVariant = undefined;
    refreshControls();
}

function fail(message) {
    const elapsed = active ? ' po ' + seconds(performance.now() - active.startedAt) : '';
    status('Chyba' + elapsed + ' · ' + message);
    dropWorker();
}

function armDeadline(limit, phase) {
    clearTimeout(deadline);
    deadline = setTimeout(() => fail('časový limit ve fázi ' + phase + ' · ' + active.stage), limit);
}

function finish() {
    clearTimeout(deadline);
    active = undefined;
    idleTimer = setTimeout(() => {
        dropWorker();
        status('Nečinný model byl uvolněn. Ukázky zůstávají k poslechu.');
    }, IDLE_LIMIT);
    refreshControls();
}

function removeClip(key) {
    const { item, url, player } = clips.get(key);
    player.pause();
    player.removeAttribute('src');
    player.load();
    URL.revokeObjectURL(url);
    item.remove();
    clips.delete(key);
    byId('empty').hidden = clips.size > 0;
}

function saveClip(request, { audio, rate }) {
    const key = [request.variant, request.delivery, request.mode, request.steps].join('/');
    if (clips.has(key)) removeClip(key);
    if (clips.size >= MAX_CLIPS) removeClip(clips.keys().next().value);

    const title = request.label + ' · ' + request.variant.toUpperCase() + ' · ' +
        (request.mode === 'sport' ? 'sportovní' : 'neutrální') + ' · ' + request.steps + ' kroků';
    const url = URL.createObjectURL(new Blob([writeWavFile(audio, rate)], { type: 'audio/wav' }));
    const item = document.createElement('li');
    const caption = document.createElement('strong');
    caption.textContent = title;
    const player = document.createElement('audio');
    player.controls = true;
    player.preload = 'none';
    player.setAttribute('aria-label', title);
    player.addEventListener('play', () => {
        for (const clip of clips.values()) {
            if (clip.player !== player) clip.player.pause();
        }
    });
    player.addEventListener('ended', () => record('Přehráno · ' + title));
    player.addEventListener('error', () => record('Chyba přehrávání · ' + title));
    player.src = url;
    item.append(caption, player);
    byId('clips').append(item);
    clips.set(key, { item, player, url });
    byId('empty').hidden = true;
}

function receive(data) {
    const request = active;
    if (!request || (data.id != null && data.id !== request.id)) return;

    switch (data.type) {
        case 'stage':
            request.stage = data.stage;
            status(data.stage);
            break;
        case 'model-ready':
            if (data.warm) {
                status('Model znovu použit z paměti.');
            } else {
                status('Načtení modelu ' + seconds(performance.now() - request.startedAt) +
                    ' · inicializace ve workeru ' + seconds(data.elapsedMs));
            }
            if (request.type === 'prepare-commentary') finish();
            else armDeadline(SYNTHESIS_LIMIT, 'syntézy');
            break;
        case 'phrase':
            request.stage = 'Fráze ' + data.done + '/' + data.total;
            status(request.stage);
            break;
        case 'audio':
            saveClip(request, data);
            status('Syntéza ' + seconds(data.elapsedMs) + ' · od spuštění ' +
                seconds(performance.now() - request.startedAt) + ' · délka ukázky ' +
                seconds(1000 * data.audio.length / data.rate));
            finish();
            break;
        case 'error':
            fail(data.message);
            break;
    }
}

function run(type) {
    if (active) return;
    clearTimeout(idleTimer);
    if (worker && workerVariant !== variant.value) dropWorker();
    active = {
        id: ++requestId, type, variant: variant.value, delivery: delivery.value,
        label: deliveries.get(delivery.value).label, mode: mode.value, steps: Number(steps.value),
        startedAt: performance.now(), stage: 'spuštění workeru',
    };
    try {
        if (!worker) {
            const url = new URL('./match-voice.worker.mjs', import.meta.url);
            url.searchParams.set('lab', 'voice-07');
            url.searchParams.set('model', active.variant);
            const instance = new Worker(url, { type: 'module' });
            worker = instance;
            workerVariant = active.variant;
            instance.onmessage = ({ data }) => {
                if (worker !== instance) return;
                try { receive(data); } catch (error) { fail(error.message); }
            };
            instance.onerror = event => {
                if (worker === instance) fail(event.message || 'worker se nepodařilo spustit');
            };
        }
        refreshControls();
        const { id, label, delivery: selected, mode: deliveryMode, steps: stepCount } = active;
        status(type === 'prepare-commentary' ? 'Připravuji ' + active.variant.toUpperCase() :
            [active.variant.toUpperCase(), label, deliveryMode, stepCount + ' kroků'].join(' · '));
        armDeadline(LOAD_LIMIT, 'načítání modelu');
        worker.postMessage({ id, type, delivery: selected, mode: deliveryMode, steps: stepCount });
    } catch (error) {
        fail(error.message);
    }
}

byId('generate').addEventListener('click', () => run('render-commentary'));
byId('prepare').addEventListener('click', () => run('prepare-commentary'));
byId('release').addEventListener('click', () => {
    const interrupted = Boolean(active);
    dropWorker();
    if (!interrupted) for (const key of clips.keys()) removeClip(key);
    refreshControls();
    status(interrupted ? 'Test zastaven. Model uvolněn.' : 'Model a ukázky uvolněny.');
});
byId('copy').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText('BANGER VOICE-07\n' + navigator.userAgent + '\n' + log.textContent);
        record('Protokol zkopírován.');
    } catch (error) {
        record('Kopírování selhalo · ' + error.message);
    }
});
window.addEventListener('pagehide', () => {
    dropWorker();
    for (const key of clips.keys()) removeClip(key);
    refreshControls();
    byId('status').textContent = 'Model a ukázky uvolněny.';
});
