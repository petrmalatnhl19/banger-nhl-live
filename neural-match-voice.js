/* Supertonic 3 M2, spun up only when the user starts the optional voice. */
(() => {
    'use strict';
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context || !window.Worker || !window.WebAssembly) return;

    const workerUrl = new URL('./voice/match-voice.worker.mjs', document.currentScript.src);
    let worker;
    let context;
    let source;
    let pending;
    let id = 0;

    function fail(error) {
        if (!pending) return;
        const request = pending;
        pending = null;
        clearTimeout(request.timer);
        request.reject(error);
    }

    function discardWorker() {
        worker?.terminate();
        worker = undefined;
    }

    function onMessage({ data }) {
        if (!pending) return;
        if (data.type === 'progress') {
            pending.onProgress(data.done, data.total);
            return;
        }
        if (data.id !== pending.id) return;
        if (data.type === 'error') {
            discardWorker();
            fail(new Error(data.message));
            return;
        }
        if (data.type !== 'audio') return;
        const request = pending;
        clearTimeout(request.timer);
        try {
            const buffer = context.createBuffer(1, data.audio.length, data.rate);
            buffer.copyToChannel(data.audio, 0);
            source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.onended = () => {
                if (pending !== request) return;
                source.disconnect();
                source = null;
                pending = null;
                request.resolve();
            };
            request.onPlay();
            if (pending === request) source.start();
        } catch (error) {
            source?.disconnect();
            source = null;
            fail(error);
        }
    }

    function stop() {
        if (pending) {
            worker?.postMessage({ type: 'cancel', id: ++id });
            fail(new DOMException('Playback stopped', 'AbortError'));
        }
        if (source) {
            source.onended = null;
            source.stop();
            source.disconnect();
            source = null;
        }
    }

    window.BangerNeuralVoice = {
        unlock() {
            context ??= new Context();
            return context.resume();
        },
        speak(text, speed, { onPlay, onProgress }) {
            stop();
            if (!worker) {
                worker = new Worker(workerUrl, { type: 'module' });
                worker.addEventListener('message', onMessage);
                worker.addEventListener('error', (event) => {
                    discardWorker();
                    fail(new Error('Worker unavailable: '+(event.message || 'module/runtime load failed')));
                });
            }
            return new Promise((resolve, reject) => {
                const requestId = ++id;
                const timer = setTimeout(() => {
                    discardWorker();
                    fail(new Error('Speech generation timed out after 180 seconds'));
                }, 180000);
                pending = { id: requestId, timer, resolve, reject, onPlay, onProgress };
                worker.postMessage({ type: 'speak', id: requestId, text, speed });
            });
        },
        pause() { return context?.suspend(); },
        resume() { return context?.resume(); },
        stop,
        release() {
            stop();
            discardWorker();
            context?.close().catch(() => {});
            context = undefined;
        },
    };
})();
