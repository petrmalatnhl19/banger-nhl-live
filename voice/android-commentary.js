/* Czech play-by-play and delivery rules shared by the match voice and its tests. */
(() => {
'use strict';

const priorities = {goal: 100, 'shootout-score': 100, 'game-end': 95, 'period-end': 85,
    'period-start': 80, 'shootout-save': 76, 'shootout-miss': 76, penalty: 72,
    'shot-on-goal': 50, 'missed-shot': 24, 'blocked-shot': 24, hit: 14,
    takeaway: 12, giveaway: 12, 'commercial-break': 10, 'delayed-penalty': 70};
const goalTypes = new Set(['goal', 'shootout-score']);
const shotTypes = new Set(['shot-on-goal', 'missed-shot']);
const scoreOk = n => Number.isInteger(n) && n >= 0;
const clock = value => {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(value || '');
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const amount = (n, one, few, many) => n + ' ' + (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
const remainingText = seconds => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return [minutes ? amount(minutes, 'minuta', 'minuty', 'minut') : '',
        rest ? amount(rest, 'sekunda', 'sekundy', 'sekund') : ''].filter(Boolean).join(' a ');
};
const periodName = number => ({1: 'první', 2: 'druhá', 3: 'třetí'}[number]);
const playerName = p => [p.firstName?.default, p.lastName?.default].filter(Boolean).join(' ');
const scoreText = (away, home, names) => {
    if (!scoreOk(away) || !scoreOk(home)) return '';
    return names.away + ' ' + away + ', ' + names.home + ' ' + home + '.';
};
const penaltyNames = {
    tripping: 'podražení', hooking: 'hákování', holding: 'držení', slashing: 'sekání',
    'high-sticking': 'hra vysokou holí', interference: 'bránění ve hře', roughing: 'hrubost',
    'cross-checking': 'krosček', 'delay-of-game': 'zdržování hry', fighting: 'bitka',
    'too-many-men': 'příliš mnoho hráčů na ledě', 'too-many-men-on-the-ice': 'příliš mnoho hráčů na ledě', boarding: 'naražení na hrazení',
    'holding-the-stick': 'držení hole', 'unsportsmanlike-conduct': 'nesportovní chování',
    'double-minor-high-sticking': 'hra vysokou holí'
};

function build(feed, names) {
    const players = new Map((feed.rosterSpots || []).filter(p => p.playerId != null)
        .map(p => [String(p.playerId), playerName(p)]));
    const actor = id => players.get(String(id)) || '';
    const teamIds = [feed.awayTeam?.id, feed.homeTeam?.id].map(x => x == null ? '' : String(x));
    const sideOf = id => id == null ? -1 : teamIds.indexOf(String(id));
    const teams = [names.away, names.home];
    const plays = [...(feed.plays || [])].sort((a, b) =>
        (a.periodDescriptor?.number || 0) - (b.periodDescriptor?.number || 0) ||
        (clock(a.timeInPeriod) ?? 0) - (clock(b.timeInPeriod) ?? 0) ||
        (a.sortOrder ?? a.eventId ?? 0) - (b.sortOrder ?? b.eventId ?? 0));
    const items = [];
    const used = new Set();
    const counts = new Map();
    const stats = [0, 0];
    let period, oldStrength, previousEvent, attempts = [], lastPressure = -Infinity;
    let periodShots = [0, 0];
    let score = null;
    let shootoutAttempt = 0, shootoutComplete = false;
    let shootoutGoals = [0, 0];

    for (const [index, event] of plays.entries()) {
        const descriptor = event.periodDescriptor || {};
        const type = event.typeDescKey;
        const v = event.details || {};
        const side = sideOf(v.eventOwnerTeamId);
        const team = teams[side];
        const player = actor(v.shootingPlayerId);
        const goalie = actor(v.goalieInNetId);
        const time = clock(event.timeInPeriod);
        const id = descriptor.number + ':' + (event.eventId ?? event.sortOrder ??
            [event.timeInPeriod, type, v.eventOwnerTeamId, v.scoringPlayerId ?? v.shootingPlayerId ?? v.committedByPlayerId].join(':'));
        if (used.has(id)) continue;
        used.add(id);
        if (period !== descriptor.number) {
            period = descriptor.number;
            oldStrength = null;
            previousEvent = null;
            attempts = [];
            lastPressure = -Infinity;
            periodShots = [0, 0];
        }
        const pick = (...phrases) => {
            const key = type;
            const count = counts.get(key) || 0;
            counts.set(key, count + 1);
            return phrases[count % phrases.length];
        };
        let text = '', mood = 'calm', kind = type, note = '', priority;
        const situation = String(event.situationCode || '');
        const skaters = /^1[3-5][3-5]1$/.test(situation) ? [Number(situation[1]), Number(situation[2])] : null;
        const even = s => s[0] === s[1];
        if (descriptor.periodType !== 'SO' && skaters && oldStrength && type !== 'penalty' && type !== 'goal') {
            const shortSide = skaters[0] < skaters[1] ? 0 : 1;
            const oldShort = oldStrength[0] < oldStrength[1] ? 0 : 1;
            if (even(oldStrength) && !even(skaters)) {
                note = 'Přesilovku má tým ' + teams[1 - shortSide] + '. ' + skaters[1 - shortSide] + ' proti ' + skaters[shortSide] + '.';
            } else if (!even(oldStrength) && even(skaters) &&
                skaters[oldShort] > oldStrength[oldShort] && skaters[1 - oldShort] === oldStrength[1 - oldShort]) {
                note = 'Tým ' + teams[oldShort] + ' je zpátky v pěti.';
                if (skaters[0] < 5) note = 'Počet hráčů v poli je opět vyrovnaný. Hraje se ' + skaters[0] + ' na ' + skaters[1] + '.';
            }
        }
        if (descriptor.periodType !== 'SO' && skaters && type !== 'penalty') oldStrength = skaters;
        else if (!skaters && situation) oldStrength = null;

        if (descriptor.periodType === 'SO' && (type === 'goal' || shotTypes.has(type))) {
            shootoutAttempt++;
            if (type === 'goal' && side >= 0) shootoutGoals[side]++;
            const shooter = actor(v.scoringPlayerId) || player || (team ? 'Hráč týmu ' + team : 'Střelec');
            if (type === 'goal') {
                kind = 'shootout-score';
                mood = 'goal';
                text = shooter + ' proměňuje nájezd!';
            } else if (type === 'shot-on-goal') {
                kind = 'shootout-save';
                mood = 'chance';
                text = goalie ? goalie + ' nájezd chytá. Zakončoval ' + shooter + '.' : 'Nájezd bez gólu. Zakončoval ' + shooter + '.';
            } else {
                kind = 'shootout-miss';
                mood = 'chance';
                text = shooter + ' při nájezdu míjí branku.';
            }
        } else if (type === 'goal') {
            if (side >= 0) {
                stats[side]++;
                periodShots[side]++;
            }
            mood = 'goal';
            const scorer = actor(v.scoringPlayerId) || (team ? 'Hráč týmu ' + team : 'Střelec');
            text = pick(scorer + ' skóruje!', 'Prosazuje se ' + scorer + '!', 'Autorem branky je ' + scorer + '!');
            if (descriptor.periodType === 'OT') text = scorer + ' střílí gól v prodloužení!';
            if (scoreOk(v.awayScore) && scoreOk(v.homeScore)) {
                score = [v.awayScore, v.homeScore];
                if (side >= 0 && score[side] > 0) {
                    const diff = score[side] - score[1 - side];
                    const late = period === 3 && time >= 1140;
                    if (descriptor.periodType !== 'OT') {
                        if (diff === 0) text = scorer + (late ? ' vyrovnává v poslední minutě!' : ' vyrovnává!');
                        else if (diff === 1) text = scorer + (late ? ' dává vedoucí gól v poslední minutě!' : ' posílá svůj tým do vedení!');
                        else if (diff < 0) text = scorer + ' snižuje ztrátu svého týmu!';
                        else text = scorer + ' zvyšuje náskok!';
                    }
                }
                text += ' ' + scoreText(...score, names);
            } else if (team) text += ' Branka pro tým ' + team + '.';
            const strength = String(v.strength || '').toLowerCase().replace(/[-_ ]/g, '');
            const empty = v.emptyNet ?? event.emptyNet;
            if ([true, 1, '1', 'true'].includes(empty)) text += ' Gól do prázdné branky.';
            else if (['pp', 'powerplay'].includes(strength) || (!strength && side >= 0 && skaters && skaters[side] > skaters[1 - side])) text += ' Přesilovkový gól.';
            else if (['sh', 'shorthanded'].includes(strength) || (!strength && side >= 0 && skaters && skaters[side] < skaters[1 - side])) text += ' Gól v oslabení.';
            const assists = [actor(v.assist1PlayerId), actor(v.assist2PlayerId)].filter(Boolean);
            if (assists.length) text += ' Asistence: ' + assists.join(' a ') + '.';
            attempts = [];
        } else if (shotTypes.has(type)) {
            const onNet = type === 'shot-on-goal';
            if (onNet && side >= 0) {
                stats[side]++;
                periodShots[side]++;
            }
            const shooter = player || (team ? 'Hráč týmu ' + team : 'Střelec');
            const close = v.zoneCode === 'O' && Number.isFinite(v.xCoord) && Number.isFinite(v.yCoord) &&
                Math.abs(v.xCoord) >= 74 && Math.abs(v.xCoord) <= 91 && Math.abs(v.yCoord) <= 12;
            mood = close ? 'chance' : onNet ? 'shot' : 'calm';
            if (close) priority = 62;
            if (onNet && goalie) {
                text = close
                    ? pick('Zakončení zblízka! ' + goalie + ' kryje střelu. Střílel ' + shooter + '.',
                        'Střela z předbrankového prostoru. ' + goalie + ' zasahuje, zakončoval ' + shooter + '.')
                    : pick(shooter + ' střílí. ' + goalie + ' zasahuje.', goalie + ' kryje střelu. Zakončoval ' + shooter + '.',
                        shooter + ' prověřuje brankáře. ' + goalie + ' střelu zastavuje.');
            } else if (onNet) text = shooter + ' střílí na branku.';
            else text = pick(shooter + ' míjí branku.', 'Pokus mimo branku. Zakončoval ' + shooter + '.',
                shooter + ' střílí vedle.');
            if (Number.isInteger(time) && side >= 0) {
                const take = previousEvent?.type === 'takeaway' && previousEvent.side === side;
                const giveaway = previousEvent?.type === 'giveaway' && previousEvent.side === 1 - side;
                if ((take || giveaway) && previousEvent.time != null && time - previousEvent.time <= 8) {
                    text = (take ? 'Krátce po zisku puku přichází střela. ' : 'Po ztrátě puku soupeře následuje střela. ') + text;
                }
                attempts = attempts.filter(x => time - x.time <= 120);
                attempts.push({side, time});
                const own = attempts.filter(x => x.side === side).length;
                const other = attempts.length - own;
                if (own >= 4 && own >= other + 3 && time - lastPressure >= 120) {
                    lastPressure = time;
                    mood = 'pressure';
                    priority = 63;
                    text += ' Střelecký tlak týmu ' + team + '. Za poslední dvě minuty ' +
                        own + ' nezblokovaných pokusů, soupeř ' + other + '.';
                } else if (period === 3 && time >= 1140 && score && Math.abs(score[0] - score[1]) <= 1 && onNet) {
                    mood = 'closing';
                    priority = 60;
                }
            }
        } else if (type === 'blocked-shot') {
            const blocker = actor(v.blockingPlayerId);
            text = blocker ? blocker + ' blokuje střelu.' : 'Zblokovaná střela.';
            if (player) text += ' Zakončoval ' + player + '.';
        } else if (type === 'penalty') {
            mood = 'penalty';
            const player = actor(v.committedByPlayerId);
            const reason = penaltyNames[String(v.descKey || '').toLowerCase().replace(/[\s_]+/g, '-')];
            text = pick('Rozhodčí vylučují.', 'Přichází trest.', 'Přerušení hry. Rozhodčí hlásí trest.');
            if (player) text += ' Potrestán je ' + player + '.';
            else if (team) text += ' Trest pro tým ' + team + '.';
            if (Number.isInteger(v.duration) && v.duration > 0) {
                text += ' Délka trestu: ' + v.duration + (v.duration === 1 ? ' minuta.' : v.duration < 5 ? ' minuty.' : ' minut.');
            }
            if (reason) text += ' Důvod: ' + reason + '.';
        } else if (type === 'delayed-penalty') {
            text = 'Rozhodčí signalizují odložený trest.';
            mood = 'penalty';
        } else if (type === 'shootout-complete' || (type === 'period-end' && descriptor.periodType === 'SO')) {
            if (!shootoutComplete) text = 'Série nájezdů končí.';
            shootoutComplete = true;
            kind = 'period-end';
            mood = 'closing';
        } else if (type === 'period-start') {
            if (descriptor.periodType === 'SO') text = 'Jdeme na nájezdy!';
            else if (descriptor.periodType === 'OT') text = 'Začíná prodloužení!';
            else if (periodName(period)) text = 'Začíná ' + periodName(period) + ' třetina.';
        } else if (type === 'period-end') {
            mood = 'closing';
            if (descriptor.periodType === 'OT') text = 'Prodloužení je u konce.';
            else if (periodName(period)) text = 'Siréna. Končí ' + periodName(period) + ' třetina.';
            if (text && descriptor.periodType !== 'SO') {
                if (score) text += ' ' + scoreText(...score, names);
                text += ' Střely na branku v této části: ' + names.away + ' ' + periodShots[0] +
                    ', ' + names.home + ' ' + periodShots[1] + '.';
            }
        } else if (type === 'game-end') {
            mood = 'closing';
            text = 'Utkání skončilo.';
            const final = scoreText(feed.awayTeam?.score, feed.homeTeam?.score, names);
            if (final) text += ' Konečný výsledek. ' + final;
        } else if (type === 'hit' && actor(v.hittingPlayerId)) {
            text = pick(actor(v.hittingPlayerId) + ' si připisuje bodyček.', 'Bodyček. Zaznamenal ho ' + actor(v.hittingPlayerId) + '.');
        } else if ((type === 'takeaway' || type === 'giveaway') && actor(v.playerId)) {
            text = actor(v.playerId) + (type === 'takeaway' ? ' získává puk.' : ' ztrácí kotouč.');
        } else if (type === 'stoppage' && /tv\s*(?:time\s*out|timeout)|commercial|television[- ]timeout/i.test(
            String(v.reason || v.stoppageReason || v.description || '').replace(/-/g, ' '))) {
            kind = 'commercial-break';
            text = 'Hra je přerušena. Probíhá televizní přestávka.';
        }
        if (note) {
            // A strength transition is an observed change in skater counts, independent of any individual return.
            text = text ? text + ' ' + note : note;
            priority = Math.max(priority ?? priorities[kind] ?? 0, 73);
            if (!priorities[kind]) kind = 'strength';
        }
        if (text) items.push({id, index, type: kind, text, mood, priority: priority ?? priorities[kind] ?? 0, period, time});
        previousEvent = {type, side, time};
    }

    const gameState = String(feed.gameState || '').toUpperCase();
    const hasEnd = items.some(item => item.type === 'game-end');
    const finished = ['FINAL', 'OFF'].includes(gameState) || hasEnd;
    const final = scoreText(feed.awayTeam?.score, feed.homeTeam?.score, names);
    if (finished && !hasEnd) {
        items.push({id: 'final', index: plays.length, type: 'game-end', mood: 'closing',
            priority: priorities['game-end'], text: 'Utkání skončilo.' + (final ? ' Konečný výsledek. ' + final : '')});
    }
    const part = feed.periodDescriptor || {};
    const partName = feed.clock?.inIntermission ? 'Probíhá přestávka.' : part.periodType === 'SO' ? 'Rozhodují nájezdy.' :
        part.periodType === 'OT' ? 'V prodloužení.' :
        periodName(part.number) ? 'Hraje se ' + periodName(part.number) + ' třetina.' : '';
    const remaining = part.periodType !== 'SO' && !feed.clock?.inIntermission ? clock(feed.clock?.timeRemaining) : null;
    const snapshotScore = scoreText(feed.awayTeam?.score, feed.homeTeam?.score, names);
    const summary = [
        'U mikrofonu komentář Banger.',
        finished ? 'Utkání skončilo.' : ['FUT', 'PRE'].includes(gameState) ? 'Čekáme na úvodní vhazování.' : partName,
        !finished && !['FUT', 'PRE'].includes(gameState) && remaining != null && remaining > 0
            ? 'Do konce této části zbývá ' + remainingText(remaining) + '.' : '',
        snapshotScore || (score ? scoreText(...score, names) : ''),
        stats.some(Boolean) ? 'Střely na branku: ' + names.away + ' ' + stats[0] + ', ' + names.home + ' ' + stats[1] + '.' : '',
        !finished && part.periodType === 'SO' && shootoutAttempt
            ? 'Proměněné nájezdy: ' + names.away + ' ' + shootoutGoals[0] + ', ' + names.home + ' ' + shootoutGoals[1] + '.' : '',
    ].filter(Boolean).join(' ');
    return {items, summary, finished, stats: stats.some(Boolean)
        ? 'Na střely na branku: ' + names.away + ' ' + stats[0] + ', ' + names.home + ' ' + stats[1] + '.' : ''};
}

function liveQueue(pending, additions) {
    const essential = [...pending, ...additions].filter(item => item.priority >= 70);
    const byIndex = (a, b) => a.index - b.index;
    if (essential.some(item => item.priority >= 85)) return essential.sort(byIndex);
    const cutoff = additions.at(-1)?.index ?? -Infinity;
    const recent = [...pending, ...additions].filter(item =>
        item.priority < 70 && item.priority >= 24 && item.index >= cutoff - 7);
    recent.sort((a, b) => b.priority - a.priority || b.index - a.index);
    return [...essential, ...recent.slice(0, Math.max(0, 3 - essential.length))].sort(byIndex);
}

function localCzechVoices(voices) {
    return voices.filter(voice => voice.localService === true && /^cs(?:[-_]|$)/i.test(voice.lang));
}

function femaleLabel(voice) {
    return /(?:^|[^\p{L}])(?:female|ženský|ženská|woman)(?:$|[^\p{L}])/iu.test(voice.name || '');
}

const delivery = {
    calm: {rate: .99, pitch: 1, gap: 90},
    shot: {rate: 1.06, pitch: 1.04, gap: 60},
    chance: {rate: 1.08, pitch: 1.12, gap: 100},
    pressure: {rate: 1.04, pitch: 1.07, gap: 120},
    penalty: {rate: .97, pitch: .99, gap: 120},
    closing: {rate: .97, pitch: 1.05, gap: 160},
    goal: {rate: 1.04, pitch: 1.12, gap: 135}
};

function segments(item, dynamic) {
    const profile = dynamic ? delivery[item.mood] || delivery.calm : delivery.calm;
    const result = [];
    if (goalTypes.has(item.type)) {
        const call = item.type === 'shootout-score' ? 'Proměněno!' : dynamic ? 'Góóól!' : 'Gól!';
        result.push({text: call, ...profile, ...(dynamic ? {rate: .8, pitch: 1.19, gap: 170} : {})});
    }
    // Short utterances keep the Android engine responsive and make Pause resume at the current phrase.
    const phrases = item.text.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u);
    let text = '';
    for (const phrase of phrases) {
        if (text && (text + phrase).length > 145) {
            result.push({text, ...profile});
            text = '';
        }
        text += (text ? ' ' : '') + phrase;
    }
    if (text) result.push({text, ...profile});
    return result;
}

globalThis.BangerAndroidCommentary = {build, liveQueue, localCzechVoices, femaleLabel, segments};
})();
