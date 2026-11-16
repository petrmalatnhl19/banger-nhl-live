import { loadTextToSpeech, loadVoiceStyle, setRuntime } from './supertonic.mjs';

const models = 'https://huggingface.co/Supertone/supertonic-3/resolve/3cadd1ee6394adea1bd021217a0e650ede09a323';
const runtime = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
// Third-party FP16 model is used only for the opt-in experiment, not production.
const fp16 = new URL(self.location.href).searchParams.get('model') === 'fp16';
const modelDirectory = fp16
    ? 'https://huggingface.co/Kyumdroid/supertonic-3-quant/resolve/main/fp16/onnx'
    : models + '/onnx';
let engine;
let latestId;
let queue = Promise.resolve();
let loadingStage = 'initializace runtime';
function reportStage(stage) {
    loadingStage = stage;
    self.postMessage({ type: 'stage', stage });
}

function getEngine() {
    if (!engine) {
        engine = (async () => {
            reportStage('načítání ONNX Runtime');
            const ort = await import(runtime + 'ort.wasm.min.mjs');
            ort.env.wasm.wasmPaths = runtime;
            ort.env.wasm.numThreads = 1;
            setRuntime(ort);
            reportStage('načítání hlasového stylu');
            const style = await loadVoiceStyle([models + '/voice_styles/M2.json']);
            reportStage(fp16 ? 'experimentální FP16 model (neověřeno na Androidu)' : 'načítání ONNX modelů');
            const { textToSpeech } = await loadTextToSpeech(modelDirectory, {
                executionProviders: ['wasm'],
                enableCpuMemArena: false,
                enableMemPattern: false,
            }, (name, done, total, detail) => {
                const phase = detail?.phase === 'ready' ? 'připraven' : 'inicializace';
                const elapsed = detail?.elapsedMs == null ? '' : ' za '+(detail.elapsedMs/1000).toFixed(1)+' s';
                reportStage('model '+name+' ('+done+'/'+total+') · '+phase+elapsed);
                self.postMessage({ type: 'progress', done, total, stage: name, phase, elapsedMs: detail?.elapsedMs ?? null });
            });
            reportStage('model připraven');
            return { textToSpeech, style };
        })().catch(error => {
            engine = undefined;
            throw error;
        });
    }
    return engine;
}

async function synthesize({ id, text, speed }) {
    if (id !== latestId) return;
    try {
        const { textToSpeech, style } = await getEngine();
        if (id !== latestId) return;
        reportStage('syntéza řeči');
        const { wav, duration } = await textToSpeech.call(text, 'cs', style, 8, speed, .14);
        if (id !== latestId) return;
        const rate = textToSpeech.sampleRate;
        const audio = Float32Array.from(wav.slice(0, Math.ceil(rate * duration[0])));
        if (!rate || !audio.length) throw new Error('Empty audio');
        self.postMessage({ type: 'audio', id, rate, audio }, [audio.buffer]);
    } catch (error) {
        if (id === latestId) self.postMessage({ type: 'error', id, message: loadingStage+': '+(error?.message || String(error)) });
    }
}

self.addEventListener('message', ({ data }) => {
    latestId = data.id;
    if (data.type !== 'speak') return;
    queue = queue.then(() => synthesize(data));
});
