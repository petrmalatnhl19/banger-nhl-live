// All fan-facing views use the reconciled publication for its NHL game day.
function selectPregameGoalie(game, team, starters, rotowire, now = Date.now()) {
  const id = game.id || game.gameId;
  const opponent = team === game.homeTeam?.abbrev ? game.awayTeam?.abbrev :
    team === game.awayTeam?.abbrev ? game.homeTeam?.abbrev : null;
  if (!id || !opponent || !starters?.date || !game.gameDate) return null;
  const date = game.gameDate;
  let row;
  if (date === starters.date) {
    const publication = Date.parse(starters.updatedAt);
    if (!Number.isFinite(publication) || publication > now || now - publication >= 86400000) return null;
    if (starters.conflicts?.some(c => c.team === team && (!c.date || c.date === date) &&
        (c.gameId == null || String(c.gameId) === String(id)))) return null;
    row = starters.teams?.[team];
  } else {
    // Only future NHL dates may use the independent, schedule-verified feed.
    if (date <= starters.date || date <= new Date(now).toISOString().slice(0, 10)) return null;
    const rw = rotowire?.games?.find(g => String(g.gameId) === String(id) &&
      g.team === team && g.opponent === opponent && g.date === date);
    if (rw) row = {...rw, name: rw.goalie, checkedAt: rotowire.updatedAt};
  }
  if (!row?.name || row.date !== date || String(row.gameId) !== String(id) ||
      !['projected', 'confirmed'].includes(row.status) || !/^https:\/\//.test(row.source)) return null;
  const checked = Date.parse(row.checkedAt);
  const start = Date.parse(game.startTimeUTC);
  if (!Number.isFinite(checked) || checked > now || now - checked >= 86400000 ||
      (Number.isFinite(start) && checked >= start)) return null;
  const confirmed = row.status === 'confirmed' && row.confirmationBasis === 'explicit_pregame_report' &&
    typeof row.confirmationEvidence === 'string' && row.confirmationEvidence.trim() && Number.isFinite(start);
  return {...row, status: confirmed ? 'confirmed' : 'projected'};
}
if (typeof module !== 'undefined') module.exports = {selectPregameGoalie};
