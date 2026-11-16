/* Facts shared by Czech match commentary and its regression tests. */
(() => {
'use strict';

const seconds = value => {
    const clock = /^(\d{1,2}):([0-5]\d)$/.exec(value || '');
    return clock ? Number(clock[1]) * 60 + Number(clock[2]) : null;
};
const normalize = value => String(value || '').toLowerCase().trim().replace(/[\s_]+/g, '-');
const int = value => Number.isInteger(value) && value >= 0;
const amount = (n, one, few, many) => n + ' ' + (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
const shootout = play => play.periodDescriptor?.periodType === 'SO';

function ordered(plays) {
    const unique = new Map();
    for (const play of Array.isArray(plays) ? plays : []) {
        if (!play?.typeDescKey) continue;
        const period = play.periodDescriptor?.number;
        const id = play.eventId ?? play.sortOrder;
        const key = id == null ? play : period + ':' + id;
        unique.set(key, play);
    }
    return [...unique.values()].sort((a, b) => {
        const period = (a.periodDescriptor?.number ?? 0) - (b.periodDescriptor?.number ?? 0);
        if (period) return period;
        if (int(a.sortOrder) && int(b.sortOrder)) return a.sortOrder - b.sortOrder;
        return (seconds(a.timeInPeriod) ?? 0) - (seconds(b.timeInPeriod) ?? 0) ||
            (a.eventId ?? 0) - (b.eventId ?? 0);
    });
}

const stoppageReasons = new Map(Object.entries({
    icing: 'Zakázané uvolnění.', offside: 'Ofsajd.', 'off-side': 'Ofsajd.',
    'puck-in-netting': 'Kotouč skončil v ochranné síti.',
    'puck-out-of-play': 'Kotouč je mimo hru.',
    'puck-frozen': 'Kotouč zůstal zakrytý.',
    'puck-frozen-goalie': 'Brankář přikrývá kotouč.',
    'goalie-stopped-after-sog': 'Brankář přerušuje hru po střele.',
    'net-off': 'Branka je posunutá.',
    'net-off-moorings': 'Branka je posunutá.',
    'hand-pass': 'Přihrávka rukou.',
    'high-stick': 'Hra vysokou holí.',
    'high-stick-puck': 'Hra vysokou holí.',
    'video-review': 'Situace se přezkoumává na videu.',
    'challenge': 'Situace se přezkoumává na videu.',
    'referee-or-linesman': 'Hru přerušují rozhodčí.',
    'player-injury': 'Hra je přerušena kvůli zranění.',
}));
const timeoutReasons = new Map(Object.entries({
    'tv-timeout': 'Televizní přestávka.',
    'television-timeout': 'Televizní přestávka.',
    'commercial-break': 'Televizní přestávka.',
    'home-timeout': 'Domácí si berou oddechový čas.',
    'visitor-timeout': 'Hosté si berou oddechový čas.',
    'away-timeout': 'Hosté si berou oddechový čas.',
    'player-injury': 'Hra je přerušena kvůli zranění.',
    'ice-problem': 'Přerušení kvůli opravě ledu.',
}));
function stoppage(details) {
    const first = normalize(details.reason ?? details.stoppageReason ?? details.description);
    const second = normalize(details.secondaryReason);
    return [...new Set([stoppageReasons.get(first) ?? timeoutReasons.get(first), timeoutReasons.get(second)].filter(Boolean))].join(' ');
}

function faceoff(play, context) {
    const d = play.details || {};
    const winner = context.player(d.winningPlayerId);
    const loser = context.player(d.losingPlayerId);
    const winnerSide = context.playerSide(d.winningPlayerId);
    const side = winnerSide >= 0 ? winnerSide : context.side(d.eventOwnerTeamId);
    const team = context.teams[side];
    let zone = '';
    if (d.zoneCode === 'N') zone = 've středním pásmu';
    else if (team && ['O', 'D'].includes(d.zoneCode)) {
        zone = (d.zoneCode === 'O' ? 'v útočném' : 'v obranném') + ' pásmu týmu ' + team;
    }
    if (winner && loser) return 'Buly vyhrává ' + winner + '. Proti němu stál ' + loser + '.' + (zone ? ' Vhazovalo se ' + zone + '.' : '');
    if (winner) return 'Buly vyhrává ' + winner + (zone ? ' ' + zone : '') + '.';
    if (team) return 'Na vhazování uspěl tým ' + team + (d.zoneCode === 'N' ? ' ve středním pásmu' : '') + '.';
    return zone ? 'Vhazuje se ' + zone + '.' : '';
}

const missReasons = new Map(Object.entries({
    'hit-post': 'Kotouč trefuje tyč.',
    'hit-crossbar': 'Kotouč trefuje břevno.',
    'wide-of-net': 'Kotouč míří vedle branky.',
    'over-net': 'Kotouč letí nad branku.',
    'short-of-net': 'Kotouč nedoletěl k brance.',
}));
const miss = details => missReasons.get(normalize(details.reason)) || '';
const shootoutText = (play, player) => {
    const d = play.details || {};
    const shooter = player(d.scoringPlayerId ?? d.shootingPlayerId);
    const goalie = player(d.goalieInNetId);
    if (play.typeDescKey === 'goal') return shooter ? shooter + ' proměňuje nájezd!' : 'Nájezd je proměněný!';
    if (play.typeDescKey === 'shot-on-goal') return goalie
        ? goalie + ' nájezd chytá.' + (shooter ? ' Zakončoval ' + shooter + '.' : '')
        : 'Nájezd končí bez gólu.' + (shooter ? ' Zakončoval ' + shooter + '.' : '');
    if (play.typeDescKey === 'missed-shot') return [shooter ? 'Nájezd jede ' + shooter + '.' : 'Nájezd.',
        miss(d) || 'Zakončení míří mimo.'].join(' ');
    if (play.typeDescKey === 'shootout-complete') return 'Série nájezdů je u konce.';
    return '';
};

function situation(value) {
    const code = String(value || '');
    return /^[01][3-6][3-6][01]$/.test(code) ? {goalies: [code[0] === '1', code[3] === '1'],
        skaters: [Number(code[1]), Number(code[2])]} : null;
}

function strengthChange(previous, current, teams, fullStrength) {
    if (!previous || !current || !teams.every(Boolean) || !current.goalies.some(Boolean)) return '';
    const pulled = [0, 1].find(i => previous.goalies[i] && !current.goalies[i] &&
        current.goalies[1 - i] && current.skaters[i] > previous.skaters[i]);
    if (pulled != null) return teams[pulled] + ' hrají bez brankáře s hráčem navíc.';
    const returned = [0, 1].find(i => !previous.goalies[i] && current.goalies[i] && current.goalies[1 - i]);
    if (returned != null) return 'Brankář týmu ' + teams[returned] + ' je zpátky v brance.';
    if (!previous.goalies.every(Boolean) || !current.goalies.every(Boolean)) return '';
    const diff = current.skaters[0] - current.skaters[1];
    const before = previous.skaters[0] - previous.skaters[1];
    if (diff && before !== diff) {
        const leading = diff > 0 ? 0 : 1;
        return 'Přesilovku má tým ' + teams[leading] + '. Hraje se ' + current.skaters[leading] +
            ' na ' + current.skaters[1 - leading] + '.';
    }
    if (!diff && before) {
        const short = before > 0 ? 1 : 0;
        if (current.skaters[short] === fullStrength && current.skaters[short] > previous.skaters[short] &&
            current.skaters[1 - short] === previous.skaters[1 - short]) {
            return teams[short] + ' jsou zpátky v plném počtu.';
        }
        return 'Počet bruslařů se vyrovnal. Hraje se ' + current.skaters[0] + ' na ' + current.skaters[1] + '.';
    }
    return '';
}

function gameFacts(game, names) {
    const teams = [game.awayTeam, game.homeTeam];
    const ids = teams.map(team => team?.id == null ? '' : String(team.id));
    const side = id => id == null ? -1 : ids.indexOf(String(id));
    const roster = new Map((game.rosterSpots || []).filter(p => p?.playerId != null).map(p => [String(p.playerId), p]));
    const playerSide = id => side(roster.get(String(id))?.teamId);
    const player = id => {
        const p = roster.get(String(id));
        return [p?.firstName?.default, p?.lastName?.default].filter(Boolean).join(' ');
    };
    const shotSide = play => {
        const d = play.details || {};
        const shooter = playerSide(d.scoringPlayerId ?? d.shootingPlayerId);
        return shooter >= 0 || play.typeDescKey === 'blocked-shot' ? shooter : side(d.eventOwnerTeamId);
    };
    const plays = ordered(game.plays);
    const regulation = plays.filter(play => !shootout(play));
    function counts(source, team) {
        const sum = {goals: 0, shots: 0, misses: 0, blocks: 0, penalties: 0, faceoffs: 0, saves: 0};
        if (team < 0 || !ids[team]) return sum;
        for (const play of source) {
            const d = play.details || {};
            if (shotSide(play) === team) {
                if (play.typeDescKey === 'goal') sum.goals++, sum.shots++;
                if (play.typeDescKey === 'shot-on-goal') sum.shots++;
                if (play.typeDescKey === 'missed-shot') sum.misses++;
                if (play.typeDescKey === 'blocked-shot') sum.blocks++;
            }
            if (play.typeDescKey === 'penalty' && side(d.eventOwnerTeamId) === team) sum.penalties++;
            if (play.typeDescKey === 'faceoff' && (playerSide(d.winningPlayerId) === team ||
                (playerSide(d.winningPlayerId) < 0 && side(d.eventOwnerTeamId) === team))) sum.faceoffs++;
            if (play.typeDescKey === 'shot-on-goal' && playerSide(d.goalieInNetId) === team) sum.saves++;
        }
        return sum;
    }
    const gameState = String(game.gameState || '');
    const final = ['FINAL', 'OFF'].includes(gameState);
    const live = ['LIVE', 'CRIT'].includes(gameState);
    const scoreboard = teams.map(t => int(t?.score) ? t.score : null);
    const shots = teams.map((t, team) => int(t?.sog) ? t.sog : regulation.length ? counts(regulation, team).shots : null);
    const scoreText = scoreboard.every(int) ? 'Skóre. ' + names[0] + ' ' + scoreboard[0] + ', ' + names[1] + ' ' + scoreboard[1] + '.' : '';
    const shotsText = shots.every(int) ? 'Střely na branku. ' + names[0] + ' ' + shots[0] + ', ' + names[1] + ' ' + shots[1] + '.' : '';
    const period = game.periodDescriptor || {};
    const part = period.periodType === 'OT' ? 'Hraje se prodloužení.' : period.periodType === 'SO' ? 'Rozhodují nájezdy.' :
        ({1: 'Hraje se první třetina.', 2: 'Hraje se druhá třetina.', 3: 'Hraje se třetí třetina.'}[period.number] || '');
    const left = seconds(game.clock?.timeRemaining);
    const remaining = live && left && !game.clock?.inIntermission && period.periodType !== 'SO'
        ? 'Do konce zbývá ' + [left >= 60 ? amount(Math.floor(left / 60), 'minuta', 'minuty', 'minut') : '',
            left % 60 ? amount(left % 60, 'sekunda', 'sekundy', 'sekund') : ''].filter(Boolean).join(' a ') + '.' : '';
    const summary = live || final ? [final ? 'Utkání je dohrané.' : game.clock?.inIntermission ? 'Probíhá přestávka.' : part,
        remaining, scoreText, shotsText].filter(Boolean).join(' ') : '';
    return {teams: names, plays, player, playerSide, side, shotSide, counts, regulation, final,
        scoreboard, scoreText, summary, shots, shootout};
}

function officialReports(game) {
    const id = String(game.id || '');
    const season = String(game.season || '');
    if (!['FINAL', 'OFF'].includes(game.gameState) || !/^\d{10}$/.test(id) ||
        !/^\d{8}$/.test(season) || !season.startsWith(id.slice(0, 4))) return [];
    const root = 'https://www.nhl.com/scores/htmlreports/' + season + '/';
    return [
        ['Průběh a hráči na ledě', 'PL'], ['Střídání hostů', 'TV'], ['Střídání domácích', 'TH'],
        ['Vhazování podle hráčů a pásem', 'FC'],
    ].map(([label, code]) => ({label, href: root + code + id.slice(4) + '.HTM'}));
}

globalThis.BangerCommentaryFacts = {gameFacts, stoppage, faceoff, miss, shootoutText, situation, strengthChange, officialReports, amount};
})();
