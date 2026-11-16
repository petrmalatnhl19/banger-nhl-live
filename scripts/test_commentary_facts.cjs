'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
require('../commentary-facts.js');
const {gameFacts, stoppage, faceoff, miss, shootoutText, situation, strengthChange, officialReports, goalKey, goalChanges} = globalThis.BangerCommentaryFacts;
const {play, names, game} = require('./commentary_fixture.cjs');

test('checks both stoppage reasons and suppresses unknown detail', () => {
    assert.equal(stoppage({reason: 'icing'}), 'Zakázané uvolnění.');
    assert.equal(stoppage({reason: 'puck-frozen-goalie', secondaryReason: 'tv-timeout'}), 'Brankář přikrývá kotouč. Televizní přestávka.');
    assert.equal(stoppage({reason: 'unrecognized'}), '');
    assert.equal(miss({reason: 'hit-crossbar'}), 'Kotouč trefuje břevno.');
    assert.equal(miss({reason: 'unrecognized'}), '');
});
test('faceoff names are resolved from the roster and the zone belongs to the winning team', () => {
    const f = gameFacts(game([]), names);
    assert.match(faceoff(play(1, 'faceoff', '03:10', {winningPlayerId: 10, losingPlayerId: 20, zoneCode: 'O'}), f),
        /Jason Robertson.*Pavel Zacha.*útočném pásmu týmu Dallas Stars/);
    assert.equal(faceoff(play(1, 'faceoff', '03:10', {zoneCode: 'D'}), f), '');
});
test('orders events by feed order and uses corrected duplicate data', () => {
    const plays = [play(10, 'faceoff', '03:10', {}, {order: 11}), play(20, 'stoppage', '03:10', {reason: 'offside'}, {order: 9}),
        play(20, 'stoppage', '03:10', {reason: 'icing'}, {order: 9})];
    const f = gameFacts(game(plays), names);
    assert.deepEqual(f.plays.map(p => p.eventId), [20, 10]);
    assert.equal(f.plays[0].details.reason, 'icing');
});
test('goals count as shots, blocks are attributed to the shooter and shootout attempts stay separate', () => {
    const so = {number: 5, part: 'SO'};
    const plays = [play(1, 'blocked-shot', '03:10', {eventOwnerTeamId: 2, shootingPlayerId: 10, blockingPlayerId: 20}),
        play(2, 'goal', '04:10', {eventOwnerTeamId: 1, scoringPlayerId: 10}),
        play(3, 'shot-on-goal', '04:20', {eventOwnerTeamId: 1, shootingPlayerId: 10, goalieInNetId: 30}),
        play(4, 'goal', '00:00', {eventOwnerTeamId: 1, scoringPlayerId: 10}, so),
        play(5, 'shot-on-goal', '00:00', {eventOwnerTeamId: 1, shootingPlayerId: 10, goalieInNetId: 30}, so)];
    const f = gameFacts(game(plays), names);
    assert.equal(f.counts(f.regulation, 0).shots, 2);
    assert.equal(f.counts(f.regulation, 0).blocks, 1);
    assert.equal(f.counts(f.regulation, 1).blocks, 0);
    assert.equal(f.counts(f.regulation, 1).saves, 1);
    assert.equal(shootoutText(plays[3], f.player), 'Jason Robertson proměňuje nájezd!');
    assert.match(shootoutText(plays[4], f.player), /Jeremy Swayman nájezd chytá/);
});
test('strength changes require recorded skater and goalie counts', () => {
    const change = (a, b, full = 5) => strengthChange(situation(a), situation(b), names, full);
    assert.match(change('1551', '1541'), /Dallas Stars.*5 na 4/);
    assert.match(change('1541', '1431'), /Dallas Stars.*4 na 3/);
    assert.match(change('1541', '1531'), /Dallas Stars.*5 na 3/);
    assert.match(change('1541', '1551'), /Boston Bruins.*plném počtu/);
    assert.match(change('1541', '1441'), /vyrovnal.*4 na 4/);
    assert.match(change('1551', '1560'), /Boston Bruins.*bez brankáře/);
    assert.match(change('1560', '1551'), /Boston Bruins.*zpátky v brance/);
    assert.equal(change('unknown', '1541'), '');
    assert.equal(change('1541', '1541'), '');
});
test('live summary prefers official totals and distinguishes breaks, final and pregame', () => {
    const f = gameFacts(game([]), names);
    assert.match(f.summary, /první třetina.*15 minut a 49 sekund.*Dallas Stars 4, Boston Bruins 1/);
    const intermission = gameFacts(game([], {clock: {inIntermission: true, timeRemaining: '01:20'}}), names);
    assert.match(intermission.summary, /Probíhá přestávka/);
    assert.doesNotMatch(intermission.summary, /Do konce/);
    assert.equal(gameFacts(game([], {gameState: 'FUT'}), names).summary, '');
    assert.match(gameFacts(game([], {gameState: 'OFF'}), names).summary, /Utkání je dohrané/);
});
test('finished-game links use NHL report paths tied to game and season', () => {
    assert.deepEqual(officialReports(game([])), []);
    const final = game([], {gameState: 'OFF', id: 2025020251, season: 20252026});
    assert.match(officialReports(final)[0].href, /20252026\/PL020251\.HTM$/);
    assert.match(officialReports(final)[2].href, /20252026\/TH020251\.HTM$/);
    assert.deepEqual(officialReports({...final, id: 'bad'}), []);
});

test('a goal relabel keeps its identity while shootout goals stay out of regulation corrections', () => {
    const d = {eventOwnerTeamId: 1, scoringPlayerId: 10};
    const first = play(4, 'goal', '04:14', d);
    const relabeled = play(66, 'goal', '04:14', {...d, scoringPlayerId: 20});
    assert.equal(goalKey(first, 0), goalKey(relabeled, 0));
    assert.equal(goalKey(play(4, 'goal', '00:00', d, {number: 5, part: 'SO'}), 0), null);
    assert.equal(goalKey(first, -1), null);
});
test('an overturned goal requires a consistent score and can be confirmed alongside a new goal', () => {
    const goal = {key: '1:254:0', side: 0};
    const next = {key: '1:332:1', side: 1};
    const before = {score: [1, 0], goals: [goal]};
    assert.equal(goalChanges(before, {score: [1, 0], goals: []}), null);
    assert.equal(goalChanges(before, {score: [0, 0], goals: [goal]}), null);
    assert.deepEqual(goalChanges(before, {score: [1, 0], goals: [goal]}), []);
    assert.deepEqual(goalChanges(before, {score: [0, 0], goals: []}), [goal.key]);
    assert.deepEqual(goalChanges(before, {score: [0, 1], goals: [next]}), [goal.key]);
});
