/* BANGER VOICE – Czech Android match commentary and replay. */
(() => {
'use strict';
const synth = window.speechSynthesis;
const android = /\bAndroid\b/i.test(navigator.userAgent);
const rules = window.BangerAndroidCommentary;
let voicePanel = null;
let voiceRoot = null;
const style=document.createElement('style');style.textContent='.bv-panel{padding:12px;margin:0 0 12px;border:1px solid #397f9b;border-radius:14px;background:linear-gradient(135deg,#143c55,#0b263b);color:#ecf9ff}.bv-panel strong{font-size:15px}.bv-controls{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.bv-panel button,.bv-panel select{background:#194d68;border:1px solid #58a3bd;color:#f0fcff;border-radius:9px;padding:8px 10px;font-size:13px}.bv-panel button:disabled{opacity:.45}.bv-panel button[aria-pressed=true]{background:#16809b}.bv-status{font-size:12px;color:#b6d8e8;line-height:1.5}.bv-panel label{font-size:12px;color:#cce8f5} .bv-advanced{margin:5px 0}.bv-advanced>summary{cursor:pointer;color:#cce8f5;font-size:12px;padding:5px 0}.bv-advanced .bv-controls{margin:7px 0}';style.textContent+=`
.bv-panel{position:relative;overflow:visible;padding:14px 15px 13px!important;border-radius:18px!important;border:1px solid rgba(95,216,245,.55)!important;background:radial-gradient(ellipse at 100% 0%,rgba(21,141,187,.24),transparent 58%),linear-gradient(145deg,#103750,#071b32)!important;box-shadow:inset 0 1px rgba(193,241,255,.13),0 8px 25px rgba(0,0,0,.16)}
.bv-panel>strong{display:block;letter-spacing:.7px;font-size:14px!important;color:#bdeefa}
.bv-panel>.bv-controls{display:flex;align-items:stretch;flex-wrap:nowrap;gap:7px;margin:12px 0 0}
.bv-panel>.bv-controls>button{flex:1 1 0;min-width:0;min-height:43px;border-radius:11px;font-size:clamp(11px,2.8vw,14px);font-weight:650;padding:8px 4px;background:linear-gradient(160deg,#205b78,#123850);border:1px solid #448da9;box-shadow:inset 0 1px rgba(255,255,255,.09)}
.bv-panel>.bv-controls>button[data-bv=start]{background:linear-gradient(145deg,#137d91,#15516b);border-color:#5bc9dc}
.bv-panel>.bv-controls>button[data-bv=stop]{background:linear-gradient(145deg,#244b68,#142f48)}
.bv-panel>.bv-controls>button:active{transform:scale(.97)}
.bv-panel>.bv-controls>.bv-advanced{flex:0 0 43px;margin:0;position:relative;min-width:43px}
.bv-panel .bv-advanced>summary{display:flex;align-items:center;justify-content:center;list-style:none;cursor:pointer;height:43px;width:43px;border-radius:11px;border:1px solid #448da9;background:linear-gradient(150deg,#205b78,#123850);font-size:21px;padding:0}
.bv-panel .bv-advanced>summary::-webkit-details-marker{display:none}
.bv-panel .bv-advanced[open]>summary{border-color:#66d9f4;box-shadow:0 0 0 2px rgba(68,199,236,.12)}
.bv-panel .bv-advanced[open]{flex-basis:100%;min-width:100%}
.bv-panel .bv-advanced[open]>summary{margin-left:auto}
.bv-panel>.bv-controls:has(.bv-advanced[open]){flex-wrap:wrap}
.bv-panel .bv-advanced>.bv-controls,.bv-panel .bv-advanced>label,.bv-panel .bv-advanced>details,.bv-panel .bv-advanced>.bv-status{width:100%}
.bv-panel .bv-advanced>.bv-controls{margin:10px 0}
@media(max-width:390px){.bv-panel{padding:11px!important}.bv-panel>.bv-controls{gap:5px}.bv-panel>.bv-controls>.bv-advanced{flex-basis:40px;min-width:40px}.bv-panel .bv-advanced>summary{width:40px}}

/* VOICE 2.0.1: mobile settings are a full-width panel, never a fourth flex item. */
.bv-panel{min-width:0!important;max-width:100%!important}
.bv-panel>.bv-controls{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr)) 43px!important;gap:7px!important;align-items:stretch!important;flex-wrap:nowrap!important;margin:12px 0 0!important}
.bv-panel>.bv-controls>button{width:100%!important;min-width:0!important;min-height:43px!important;height:43px!important;white-space:nowrap!important;line-height:1.15!important;padding:7px 3px!important}
.bv-panel>.bv-advanced{display:block!important;position:static!important;min-width:0!important;width:100%!important;margin:0!important}
.bv-panel>.bv-advanced:not([open]){height:0!important}
.bv-panel>.bv-advanced>summary{position:absolute!important;right:15px!important;top:43px!important;width:43px!important;height:43px!important;box-sizing:border-box!important;z-index:2}
.bv-panel>.bv-advanced[open]{margin-top:12px!important;padding:12px!important;border:1px solid rgba(88,163,189,.35)!important;border-radius:12px!important;background:rgba(4,24,42,.58)!important}
.bv-panel>.bv-advanced[open]>summary{top:43px!important}
.bv-panel>.bv-advanced>.bv-controls{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:0 0 12px!important}
.bv-panel>.bv-advanced label{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important}
.bv-panel>.bv-advanced>.bv-controls label{display:flex!important;flex-direction:column!important;gap:5px!important}
.bv-panel>.bv-advanced select,.bv-panel>.bv-advanced input:not([type=checkbox]){width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
.bv-panel>.bv-advanced label:has(input[type=checkbox]){display:flex!important;align-items:flex-start!important;gap:9px!important;line-height:1.5!important}
.bv-panel>.bv-advanced input[type=checkbox]{flex:0 0 auto!important;margin-top:3px!important}
.bv-panel>.bv-advanced details div{max-width:100%!important;min-width:0!important}
@media(max-width:390px){.bv-panel>.bv-controls{grid-template-columns:repeat(3,minmax(0,1fr)) 40px!important;gap:5px!important}.bv-panel>.bv-advanced>summary{right:11px!important;top:40px!important;width:40px!important;height:43px!important}.bv-panel>.bv-advanced[open]>summary{top:40px!important}.bv-panel>.bv-advanced>.bv-controls{grid-template-columns:1fr!important}}

.bv-panel>.bv-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px;padding:4px;border:1px solid rgba(96,190,220,.32);border-radius:12px;background:rgba(2,18,34,.55)}
.bv-panel>.bv-mode-switch>button{width:100%;min-width:0;padding:9px 5px;font-weight:700;border:1px solid transparent;background:transparent;color:#a8cbd9;border-radius:9px}
.bv-panel>.bv-mode-switch>button[aria-pressed=true]{background:linear-gradient(135deg,#136e8b,#17465f);color:#fff;border-color:#5ad3e9;box-shadow:0 2px 12px #00d8ff22}
`;document.head.appendChild(style);
const clean = text => String(text || '').trim();
const defaults={'Dallas Stars':'Dallas Stárz','Edmonton Oilers':'Edmonton Ojlers','Florida Panthers':'Florida Pentrz','Vegas Golden Knights':'Vegas Gouden Najts','Seattle Kraken':'Sietl Kraken','Jack Hughes':'Džek Hjůz','Connor McDavid':'Konor Mekdejvid','Cale Makar':'Kejl Makár','Ukko-Pekka Luukkonen':'Ukko Pekka Lúkkonen','Matthew Tkachuk':'Metjú Kačak','Brady Tkachuk':'Brejdy Kačak','Jason Robertson':'Džejson Robertson','Jacob Trouba':'Džejkob Trúba','Jake Oettinger':'Džejk Otinger','Jack Eichel':'Džek Ajkl','Quinn Hughes':'Kvin Hjůz','Mikko Rantanen':'Mikko Rantanen','Nathan MacKinnon':'Nejtan Mekinon','Auston Matthews':'Óston Metjús','Kirill Kaprizov':'Kirill Kaprizov','Leon Draisaitl':'Leon Drajzajtl'};
const storageKey='banger-voice-pronunciation-v1';let custom={};try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))custom=saved}catch(_){};
const escapeRegExp=s=>Array.from(s).map(ch=>/[A-Za-z0-9À-ž ]/u.test(ch)?ch:'\\u'+ch.codePointAt(0).toString(16).padStart(4,'0')).join('');
function speechText(text){let output=clean(text);const entries=Object.entries({...defaults,...custom}).filter(([name,pron])=>name.trim()&&typeof pron==='string'&&pron.trim()).sort((a,b)=>b[0].length-a[0].length);for(const [name,pron] of entries){try{const rx=new RegExp('(^|[^\\p{L}])('+escapeRegExp(name)+')(?=$|[^\\p{L}])','giu');output=output.replace(rx,(_,before)=>before+pron)}catch(err){console.warn('Přepis výslovnosti přeskočen:',name,err)}}return output}
function savePronunciation(){const panel=voicePanel;const name=panel?.querySelector('[data-bv=name]')?.value.trim(),pron=panel?.querySelector('[data-bv=pron]')?.value.trim();if(!name||!pron){panel.querySelector('[data-bv=pron-status]').textContent='Vyplň jméno i požadovanou výslovnost.';return}if(name.length>90||pron.length>120){panel.querySelector('[data-bv=pron-status]').textContent='Zadaný text je příliš dlouhý.';return}custom[name]=pron;try{localStorage.setItem(storageKey,JSON.stringify(custom));panel.querySelector('[data-bv=pron-status]').textContent='Výslovnost uložena v tomto prohlížeči.'}catch(_){panel.querySelector('[data-bv=pron-status]').textContent='Uložení v prohlížeči není dostupné.'}}

const state = {
    id: null, latest: [], summary: '', finished: false, stats: '', lastSpokenStats: '',
    mode: 'replay', playing: false, paused: false, error: '',
    queue: [], seen: new Set(), active: null, utterance: null,
    segment: 0, parts: [], nextTimer: null, watchdog: null,
    lastActivity: 0,
};
const voiceStorage = 'banger-commentary-android-voice';
let confirmedVoice = '';
try { confirmedVoice = localStorage.getItem(voiceStorage) || ''; } catch (_) {}

const control = name => voicePanel?.querySelector('[data-bv="' + name + '"]');
const voiceId = voice => voice.voiceURI || voice.name;
const candidates = () => android && synth
    ? rules.localCzechVoices(synth.getVoices()).sort((a, b) =>
        Number(rules.femaleLabel(b)) - Number(rules.femaleLabel(a)) ||
        Number(/^cs[-_]cz$/i.test(b.lang)) - Number(/^cs[-_]cz$/i.test(a.lang)) ||
        Number(b.default) - Number(a.default))
    : [];

function voiceForPlayback() {
    const list = candidates();
    return list.find(voice => voiceId(voice) === confirmedVoice) || list.find(rules.femaleLabel);
}

function refreshVoiceList() {
    const select = control('voice');
    if (!select) return;
    const list = candidates();
    const wanted = select.value || voiceId(voiceForPlayback() || {}) || '';
    select.replaceChildren(new Option(list.length ? 'Vyber český hlas' : 'Místní český hlas nenalezen', ''));
    for (const voice of list) select.add(new Option(voice.name, voiceId(voice)));
    if (list.some(voice => voiceId(voice) === wanted)) select.value = wanted;
    else if (list.length === 1) select.value = voiceId(list[0]);
    update();
}

function update() {
    if (!voicePanel?.isConnected) return;
    const voice = voiceForPlayback();
    const selected = Boolean(control('voice').value);
    const pendingVoice = selected && control('voice').value !== voiceId(voice || {});
    const status = state.error || (
        !android ? 'Komentář používá místní český hlas na Androidu.' :
        !synth ? 'Tento prohlížeč nepodporuje hlas zařízení.' :
        !candidates().length ? 'V nastavení převodu textu na řeč stáhni český hlas a znovu otevři zápas.' :
        state.paused ? 'Pozastaveno.' :
        state.playing ? (state.mode === 'live' ? 'Živě' : 'Přehrávání od začátku') :
        voice ? 'Připraveno · ' + voice.name : 'V nastavení komentáře poslechni a potvrď český ženský hlas.');
    voicePanel.classList.toggle('bv-speaking', Boolean(state.utterance));
    voicePanel.querySelector('.bv-status').textContent = status;
    control('pause').textContent = state.paused ? '▶ Pokračovat' : '⏸ Pauza';
    control('pause').disabled = !state.playing;
    control('start').disabled = !voice || pendingVoice;
    control('test-pron').disabled = !voice;
    control('preview').disabled = !selected;
    control('confirm').disabled = !selected;
}

function clearTimers() {
    clearTimeout(state.nextTimer);
    clearTimeout(state.watchdog);
    state.nextTimer = state.watchdog = null;
}

function cancelAudio() {
    clearTimers();
    const utterance = state.utterance;
    state.utterance = null;
    if (utterance || synth?.speaking || synth?.pending || synth?.paused) synth?.cancel();
}

function clearActive() {
    state.active = null;
    state.parts = [];
    state.segment = 0;
}

function stop() {
    cancelAudio();
    clearActive();
    state.queue = [];
    state.playing = state.paused = false;
    state.error = '';
    update();
}

function fail(message) {
    stop();
    state.error = message;
    update();
}

function speak(part, voice, onEnd) {
    if (!voice) {
        fail('Zvolený český hlas není dostupný. Otevři nastavení komentáře.');
        return;
    }
    try {
        const utterance = new SpeechSynthesisUtterance(speechText(part.text));
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = Math.max(.65, Math.min(1.4, Number(control('rate').value) * part.rate));
        utterance.pitch = part.pitch;
        const current = () => state.utterance === utterance;
        const timeout = () => {
            if (current()) fail('Hlas zařízení neodpovídá. Zkus komentář spustit znovu.');
        };
        utterance.onstart = () => {
            if (!current()) return;
            clearTimeout(state.watchdog);
            state.watchdog = setTimeout(timeout, 20000);
        };
        utterance.onend = () => {
            if (!current()) return;
            clearTimeout(state.watchdog);
            state.watchdog = null;
            state.utterance = null;
            update();
            onEnd();
        };
        utterance.onerror = () => {
            if (current()) fail('Český hlas nelze přehrát. Zkontroluj stažená hlasová data v Androidu.');
        };
        state.utterance = utterance;
        state.watchdog = setTimeout(timeout, 7000);
        synth.speak(utterance);
        update();
    } catch (_) {
        fail('Hlas zařízení se nepodařilo spustit.');
    }
}

function pump() {
    if (!state.playing || state.paused || state.utterance || state.nextTimer !== null) return;
    if (!state.active) {
        state.active = state.queue.shift();
        if (!state.active) {
            if (state.mode === 'replay' || state.finished) state.playing = false;
            update();
            return;
        }
        state.parts = rules.segments(state.active, control('dynamic').checked);
        state.segment = 0;
    }
    const part = state.parts[state.segment];
    if (!part) {
        clearActive();
        pump();
        return;
    }
    speak(part, voiceForPlayback(), () => {
        if (++state.segment >= state.parts.length) clearActive();
        state.nextTimer = setTimeout(() => {
            state.nextTimer = null;
            pump();
        }, part.gap);
    });
}

function start() {
    refreshVoiceList();
    if (control('start').disabled) return;
    stop();
    state.mode = control('pick-live').getAttribute('aria-pressed') === 'true' ? 'live' : 'replay';
    state.seen = new Set(state.latest.map(item => item.id));
    state.lastActivity = Date.now();
    state.lastSpokenStats = state.stats;
    state.queue = state.mode === 'live' && state.summary
        ? [{id: 'summary', type: 'summary', mood: 'calm', priority: 0, text: state.summary}]
        : [...state.latest];
    if (!state.queue.length) {
        state.error = 'Zatím nejsou dostupné události k přečtení.';
        update();
        return;
    }
    state.playing = true;
    pump();
}

function togglePause() {
    if (!state.playing) return;
    state.paused = !state.paused;
    if (state.paused) cancelAudio();
    else pump();
    update();
}

function preview(text, voice) {
    if (!text || !voice) return;
    stop();
    const item = {type: 'preview', mood: 'calm', text};
    speak(rules.segments(item, true)[0], voice, () => {});
}

function mount(root) {
    if (voiceRoot === root && voicePanel) {
        if (!voicePanel.isConnected) root.prepend(voicePanel);
        return;
    }
    voiceRoot = root;
    voicePanel = document.createElement('section');
    voicePanel.className = 'bv-panel';
    voicePanel.innerHTML = '<strong>🎙️ Hlasový komentář</strong><div class="bv-mode-switch" role="group" aria-label="Režim přehrávání"><button type="button" data-bv="pick-live" aria-pressed="false">🔴 Živě</button><button type="button" data-bv="pick-replay" aria-pressed="true">⏮ Od začátku</button></div><div class="bv-controls"><button type="button" data-bv="start">▶ Spustit</button><button type="button" data-bv="pause">⏸ Pauza</button><button type="button" data-bv="stop">⏹ Zastavit</button><details class="bv-advanced"><summary title="Nastavení hlasu" aria-label="Nastavení hlasu">⚙️</summary><div class="bv-controls"><label>Rychlost <select data-bv="rate"><option value=".85">0,85×</option><option value="1" selected>1×</option><option value="1.15">1,15×</option><option value="1.3">1,3×</option></select></label></div><label style="display:flex;align-items:center;gap:6px;margin:6px 0"><input type="checkbox" data-bv="dynamic" checked> 🎭 Sportovní přednes</label><label style="display:flex;align-items:center;gap:6px;margin:6px 0"><input type="checkbox" data-bv="radio" checked> 📻 Aktualizované střelecké statistiky během čekání</label><details style="margin:9px 0"><summary style="cursor:pointer;font-size:12px;color:#cce8f5">🗣️ Upravit výslovnost hráče</summary><div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px"><input data-bv="name" placeholder="Jméno hráče (např. Jack Hughes)" aria-label="Jméno hráče" style="min-width:180px;flex:1;background:#0c2a40;color:white;border:1px solid #58a3bd;border-radius:8px;padding:8px"><input data-bv="pron" placeholder="Jak se má vyslovit" aria-label="Fonetický přepis" style="min-width:160px;flex:1;background:#0c2a40;color:white;border:1px solid #58a3bd;border-radius:8px;padding:8px"><button type="button" data-bv="save-pron">Uložit výslovnost</button><button type="button" data-bv="test-pron">🔊 Vyzkoušet</button></div><div data-bv="pron-status" style="font-size:11px;margin-top:5px;color:#a9d5e8">Přepis výslovnosti se použije při přehrávání.</div></details></details></div><div class="bv-status" role="status"></div>';
    const controls = voicePanel.querySelector(':scope > .bv-controls');
    const advanced = controls.querySelector(':scope > .bv-advanced');
    controls.after(advanced);
    const settings = document.createElement('div');
    settings.className = 'bv-controls';
    settings.innerHTML = '<label>Český hlas Androidu<select data-bv="voice"></select></label>' +
        '<div><button type="button" data-bv="preview">Poslechnout ukázku</button> ' +
        '<button type="button" data-bv="confirm">Potvrdit ženský hlas</button></div>';
    advanced.prepend(settings);
    root.prepend(voicePanel);
    const setMode = mode => {
        if (control('pick-' + mode).getAttribute('aria-pressed') === 'true') return;
        stop();
        for (const key of ['live', 'replay']) {
            control('pick-' + key).setAttribute('aria-pressed', String(mode === key));
        }
    };
    control('pick-live').addEventListener('click', () => setMode('live'));
    control('pick-replay').addEventListener('click', () => setMode('replay'));
    control('start').addEventListener('click', start);
    control('pause').addEventListener('click', togglePause);
    control('stop').addEventListener('click', stop);
    control('voice').addEventListener('change', stop);
    control('preview').addEventListener('click', () =>
        preview('Krásný hokejový večer. Connor McDavid střílí! A máme vyrovnáno.', candidates().find(v => voiceId(v) === control('voice').value)));
    control('confirm').addEventListener('click', () => {
        stop();
        confirmedVoice = control('voice').value;
        try { localStorage.setItem(voiceStorage, confirmedVoice); } catch (_) {}
        update();
    });
    control('save-pron').addEventListener('click', savePronunciation);
    control('test-pron').addEventListener('click', () => preview(control('name').value.trim(), voiceForPlayback()));
    refreshVoiceList();
}

document.addEventListener('banger:commentary', event => {
    const {id, items, summary, finished, stats} = event.detail || {};
    const root = document.getElementById('commentaryFeed');
    if (!id || !Array.isArray(items) || !root) return;
    if (state.id !== id) {
        stop();
        state.id = id;
    }
    Object.assign(state, {latest: items, summary, finished, stats});
    mount(root);
    if (state.playing && state.mode === 'live') {
        const additions = items.filter(item => !state.seen.has(item.id));
        for (const item of additions) state.seen.add(item.id);
        if (additions.length) {
            const fresh = new Map(items.map(item => [item.id, item]));
            const pending = state.queue.map(item => fresh.get(item.id)).filter(Boolean);
            state.lastActivity = Date.now();
            state.queue = rules.liveQueue(pending, additions);
            const urgent = additions.some(item => item.priority >= 85);
            if (state.active && ((urgent && state.active.priority < 70) || state.active.type === 'radio')) {
                cancelAudio();
                clearActive();
            }
        }
        pump();
    }
    update();
});

setInterval(() => {
    if (!state.playing || state.paused || state.mode !== 'live' || state.finished || !control('radio')?.checked ||
        document.hidden || state.active || state.queue.length || !state.stats || state.stats === state.lastSpokenStats ||
        Date.now() - state.lastActivity < 60000) return;
    state.lastSpokenStats = state.stats;
    state.lastActivity = Date.now();
    state.queue.push({id: 'radio', type: 'radio', text: state.stats, mood: 'calm', priority: 0});
    pump();
}, 10000);

synth?.addEventListener?.('voiceschanged', refreshVoiceList);
document.addEventListener('banger:commentary-stop', () => {
    stop();
    Object.assign(state, {id: null, latest: [], summary: '', finished: false, stats: ''});
});
document.addEventListener('visibilitychange', () => {
    if (!document.getElementById('commentaryFeed')) stop();
});
window.addEventListener('pagehide', stop);
})();
