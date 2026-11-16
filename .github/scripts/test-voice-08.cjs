'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
require('../../voice/android-commentary.js');
const {event, names, shooter, feed} = require('./voice-08-fixture.cjs');
const {build, liveQueue, localCzechVoices, femaleLabel, segments} = globalThis.BangerAndroidCommentary;
const goal = {eventOwnerTeamId: 22, scoringPlayerId: 1, assist1PlayerId: 3, awayScore: 1, homeScore: 0};
const near = {...shooter, zoneCode: 'O', xCoord: 83, yCoord: -4};

test('calls only recorded shot, save, scorer, score and assist facts', () => {
    const duplicate = event(4, 'goal', '04:24', goal);
    const {items} = build(feed([event(1, 'shot-on-goal', '01:01', near),
        event(2, 'shot-on-goal', '01:02', {...shooter, goalieInNetId: 1000}),
        event(3, 'missed-shot', '04:20', shooter), duplicate, duplicate]), names);
    assert.equal(items.length, 4);
    assert.match(items[0].text, /zblízka.*Sergei Bobrovsky.*Connor McDavid/i);
    assert.equal(items[0].mood, 'chance');
    assert.doesNotMatch(items[1].text, /zasahuje|kryje|Bobrovsky/);
    assert.match(items[2].text, /míjí|mimo|vedle/);
    assert.match(items[3].text, /do vedení.*Edmonton Oilers 1, Florida Panthers 0.*Leon Draisaitl/);
});

test('penalties and observed skater counts announce advantage and team return', () => {
    const strength = situation => ({situation});
    const {items} = build(feed([
        event(1, 'faceoff', '00:12'),
        event(2, 'penalty', '00:20', {eventOwnerTeamId: 13, committedByPlayerId: 2, duration: 2, descKey: 'tripping'}),
        event(3, 'faceoff', '00:20', {}, strength('1541')),
        event(4, 'shot-on-goal', '02:20', shooter, strength('1541')),
        event(5, 'shot-on-goal', '02:21', shooter),
        event(6, 'shot-on-goal', '02:24', shooter, strength('1650')),
        event(7, 'goal', '02:27', {...goal, strength: 'sh'}),
    ]), names);
    assert.match(items[0].text, /Bobrovsky.*2 minuty.*podražení/);
    assert.match(items[1].text, /Přesilovku.*Edmonton Oilers.*5 proti 4/);
    assert.doesNotMatch(items[2].text, /zpátky|vyrovnaný/);
    assert.match(items[3].text, /Florida Panthers je zpátky v pěti/);
    assert.doesNotMatch(items[4].text, /Přesilovku|oslabení/);
    assert.match(items[5].text, /Gól v oslabení/);
});

test('streaks use recorded unblocked attempts and reset by period', () => {
    const type = 'shot-on-goal';
    const plays = [
        event(1, 'takeaway', '01:00', {eventOwnerTeamId: 22, playerId: 1}),
        event(2, type, '01:03', shooter), event(3, type, '01:09', shooter),
        event(4, 'blocked-shot', '01:10', shooter),
        event(5, type, '01:20', shooter), event(6, type, '01:23', shooter),
        event(7, 'period-end', '20:00'),
        event(8, type, '00:12', shooter, {period: 2}),
    ];
    const {items} = build(feed(plays), names);
    assert.match(items[1].text, /po zisku puku/);
    assert.equal(items.filter(e => e.mood === 'pressure').length, 1);
    assert.match(items.find(e => e.mood === 'pressure').text, /4 nezblokovaných pokusů/);
    assert.match(items.find(e => e.type === 'period-end').text, /Edmonton Oilers 4, Florida Panthers 0/);
    assert.doesNotMatch(items.at(-1).text, /Střelecký tlak/);
    assert.notEqual(items[1].text, items[2].text);
});

test('shootout order, shootout scoreboard and final result are separate from regulation', () => {
    const ot = {period: 4, type: 'OT'};
    const so = {period: 5, type: 'SO'};
    const plays = [
        event(3, 'goal', '00:00', {...goal, awayScore: 8, homeScore: 9}, so),
        event(1, 'period-start', '00:00', {}, ot),
        {...event(17, 'shot-on-goal', '00:00', shooter, so), sortOrder: 2},
        event(4, 'missed-shot', '00:00', shooter, so),
        event(5, 'period-end', '00:00', {}, so),
        event(6, 'shootout-complete', '00:00', {}, so),
    ];
    const snapshot = feed(plays, {gameState: 'OFF', awayTeam: {id: 22, score: 2}, homeTeam: {id: 13, score: 1}});
    const {items, summary, finished, stats} = build(snapshot, names);
    assert.deepEqual(items.map(e => e.type), ['period-start', 'shootout-save', 'shootout-score', 'shootout-miss', 'period-end', 'game-end']);
    assert.match(items[0].text, /Začíná prodloužení/);
    assert.doesNotMatch(items[2].text, /8|9|Asistence/);
    assert.match(items.at(-1).text, /Konečný výsledek.*Edmonton Oilers 2, Florida Panthers 1/);
    assert.match(summary, /Utkání skončilo/);
    assert.equal(stats, '');
    assert.equal(finished, true);
});

test('mid-game summary and late tying goal use verified clock and score', () => {
    const part = {period: 3};
    const data = feed([event(9, 'goal', '19:35', {...goal, awayScore: 2, homeScore: 2}, part)],
        {awayTeam: {id: 22, score: 2}, homeTeam: {id: 13, score: 2}, clock: {timeRemaining: '00:25'},
            periodDescriptor: {number: 3, periodType: 'REG'}});
    const result = build(data, names);
    assert.match(result.summary, /třetí třetina.*25 sekund.*Edmonton Oilers 2, Florida Panthers 2/);
    assert.match(result.items[0].text, /vyrovnává v poslední minutě/);
    assert.equal(segments(result.items[0], true)[0].text, 'Góóól!');
    assert.equal(segments(result.items[0], false)[0].text, 'Gól!');
    assert.ok(segments(result.items[0], true)[0].rate < segments(result.items[0], true)[1].rate);
});

test('live prioritization keeps essential plays and limits routine narration', () => {
    const item = (index, priority) => ({index, id: String(index), priority});
    assert.deepEqual(liveQueue([item(2, 50), item(3, 72)], [item(4, 24), item(5, 100), item(6, 95)]).map(e => e.index), [3, 5, 6]);
    assert.deepEqual(liveQueue([item(1, 62)], [item(10, 14), item(11, 24), item(12, 50), item(13, 50), item(14, 63)]).map(e => e.index), [12, 13, 14]);
});

test('only local Czech voices are offered and gender labels require a matching word', () => {
    const unknown = {name: 'Čeština', lang: 'cs-CZ', localService: true};
    const sample = {name: 'Český ženský hlas', lang: 'cs-CZ', localService: true};
    assert.deepEqual(localCzechVoices([unknown, sample, {lang: 'cs-CZ', localService: false}, {lang: 'pl', localService: true}]), [unknown, sample]);
    assert.equal(femaleLabel(unknown), false);
    assert.equal(femaleLabel(sample), true);
    assert.equal(femaleLabel({name: 'Male voice'}), false);
});
