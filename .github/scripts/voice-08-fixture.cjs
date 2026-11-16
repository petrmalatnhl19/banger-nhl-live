'use strict';

const event = (eventId, typeDescKey, timeInPeriod, details = {}, options = {}) => ({
    eventId, sortOrder: eventId, typeDescKey, timeInPeriod, details,
    periodDescriptor: {number: options.period || 1, periodType: options.type || 'REG'},
    situationCode: options.situation || '1551',
});
const names = {away: 'Edmonton Oilers', home: 'Florida Panthers'};
const shooter = {eventOwnerTeamId: 22, shootingPlayerId: 1, goalieInNetId: 2};
const roster = [
    [1, 'Connor', 'McDavid'], [2, 'Sergei', 'Bobrovsky'], [3, 'Leon', 'Draisaitl'],
].map(([playerId, first, last]) => ({playerId, firstName: {default: first}, lastName: {default: last}}));
const feed = (plays, overrides = {}) => ({
    id: 2026020335, gameType: 2, gameState: 'LIVE',
    awayTeam: {id: 22, abbrev: 'EDM', score: 0},
    homeTeam: {id: 13, abbrev: 'FLA', score: 0},
    periodDescriptor: {number: 1, periodType: 'REG'},
    clock: {timeRemaining: '12:02', inIntermission: false},
    rosterSpots: roster, plays, ...overrides,
});

module.exports = {event, names, shooter, feed};
