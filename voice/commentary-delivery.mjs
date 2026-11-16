// Each phrase carries its synthesis speed, gain and pause after the phrase.
export const deliveries = new Map([
    ['play', {
        label: 'Běžný komentář',
        phrases: [
            ['Dallas Stars drží kotouč ve středním pásmu.', 1.03, 0.90, 180],
            ['Teď rozehrávají po pravé straně.', 1.08, 0.97, 0],
        ],
    }],
    ['danger', {
        label: 'Nebezpečná akce',
        phrases: [
            ['Pozor, Dallas Stars jdou dva na jednoho!', 1.13, 0.87, 90],
            ['Přihrávka před branku!', 1.18, 1.12, 0],
        ],
    }],
    ['chance', {
        label: 'Velká šance',
        phrases: [
            ['Robertson sám před brankářem…', 0.97, 0.83, 280],
            ['Střela zblízka!', 1.15, 1.14, 100],
            ['A brankář ji vyráží!', 1.10, 1.02, 0],
        ],
    }],
    ['goal', {
        label: 'Gól',
        phrases: [
            ['Robertson napřahuje…', 1.12, 0.84, 180],
            ['Gól!', 0.85, 1.22, 280],
            ['Dallas Stars jdou do vedení!', 1.10, 1.05, 0],
        ],
    }],
    ['analysis', {
        label: 'Rozbor zápasu',
        phrases: [
            ['Dallas Stars dnes dobře zavírají střední pásmo.', 0.95, 0.92, 300],
            ['Soupeře tím nutí rozehrávat po mantinelu.', 0.99, 0.88, 0],
        ],
    }],
]);

export async function renderDelivery(engine, { delivery, mode, steps }, onPhrase) {
    const profile = deliveries.get(delivery);
    if (!profile || !['neutral', 'sport'].includes(mode) || ![4, 8].includes(steps)) {
        throw new Error('Neplatný profil komentáře');
    }

    const { textToSpeech, style } = engine;
    const rate = textToSpeech.sampleRate;
    if (!Number.isInteger(rate) || rate <= 0) throw new Error('Neplatná vzorkovací frekvence');
    const clips = [];
    let length = 0;
    let peak = 0;
    for (const [index, [text, speed, gain, pause]] of profile.phrases.entries()) {
        const last = index === profile.phrases.length - 1;
        const directed = mode === 'sport';
        onPhrase(index + 1, profile.phrases.length);
        const { wav } = await textToSpeech.call(text, 'cs', style, steps, directed ? speed : 1.05);
        const samples = Float32Array.from(wav);
        if (!samples.length) throw new Error('Model vrátil prázdný zvuk');
        // Short edge fades avoid clicks when joining independently generated phrases.
        const fade = Math.max(1, Math.floor(Math.min(rate * 0.005, samples.length / 2)));
        for (let i = 0; i < samples.length; i++) {
            const edge = Math.min(1, i / fade, (samples.length - 1 - i) / fade);
            const value = samples[i] * edge * (directed ? gain : 1);
            if (!Number.isFinite(value)) throw new Error('Model vrátil neplatný vzorek zvuku');
            samples[i] = value;
            peak = Math.max(peak, Math.abs(value));
        }
        const gap = last ? 0 : Math.round(rate * (directed ? pause : 180) / 1000);
        clips.push({ samples, offset: length });
        length += samples.length + gap;
    }
    const audio = new Float32Array(length);
    // Apply one peak correction to preserve the relative emphasis across phrases.
    const scale = peak > 0.98 ? 0.98 / peak : 1;
    for (const { samples, offset } of clips) {
        for (let i = 0; i < samples.length; i++) audio[offset + i] = samples[i] * scale;
    }
    return { audio, rate };
}
