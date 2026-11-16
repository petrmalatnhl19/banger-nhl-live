'use strict';
const play = (id, type, time, details = {}, options = {}) => ({
    eventId: id, sortOrder: options.order ?? id, typeDescKey: type, timeInPeriod: time,
    periodDescriptor: {number: options.number ?? 1, periodType: options.part || 'REG'},
    situationCode: options.situation || '1551', details,
});
const names = ['Dallas Stars', 'Boston Bruins'];
const game = (plays, options = {}) => ({
    id: 2026020999, season: 20262027, gameType: 2, gameState: 'LIVE',
    awayTeam: {id: 1, abbrev: 'DAL', score: 0, sog: 4},
    homeTeam: {id: 2, abbrev: 'BOS', score: 0, sog: 1},
    rosterSpots: [[10, 1, 'Jason', 'Robertson'], [20, 2, 'Pavel', 'Zacha'], [30, 2, 'Jeremy', 'Swayman']]
        .map(([playerId, teamId, first, last]) => ({playerId, teamId, firstName: {default: first}, lastName: {default: last}})),
    periodDescriptor: {number: 1, periodType: 'REG'}, clock: {timeRemaining: '15:49'}, plays,
    ...options,
});
module.exports = {play, names, game};
