// Run inside Chromium so the HTML table and clock are parsed exactly as on the match page.
module.exports = async function testGameLineups(page, assert) {
  const results = await page.evaluate(() => {
    const box = { id: 2026020001, gameDate: '2026-11-17', awayTeam: {id: 1}, homeTeam: {id: 2}, playerByGameStats: {} };
    const play = { id: box.id, rosterSpots: [], plays: [] };
    const cells = [];
    for (const [index, side] of ['awayTeam', 'homeTeam'].entries()) {
      const players = [];
      const tags = [];
      const count = index ? 5 : 6;
      for (let n = 1; n <= count; n++) {
        const id = 100 * (index + 1) + n;
        const position = n === count ? 'G' : 'C';
        const surname = 'Player' + String.fromCharCode(64 + n);
        players.push({playerId: id, sweaterNumber: n, position});
        play.rosterSpots.push({teamId: index + 1, playerId: id, sweaterNumber: n, positionCode: position, firstName: {default: side}, lastName: {default: surname}});
        tags.push('<font title="Position - ' + side + ' ' + surname + '">' + n + '</font>');
      }
      box.playerByGameStats[side] = { players };
      cells.push('<td>' + tags.join('') + '</td>');
    }
    const html = '<table id="GameInfo"><tr><td>Game 0001</td><td>Final</td><td>Tuesday, November 17, 2026</td></tr></table>' +
      '<table><tr><td>1</td><td>1</td><td>PP</td><td>2:00<br>18:00</td><td>FAC</td><td></td>' + cells.join('') + '</tr></table>';
    const event = {typeDescKey: 'faceoff', timeInPeriod: '02:00', periodDescriptor: {number: 1}, situationCode: '1541', details: {winningPlayerId: 101, losingPlayerId: 201}};
    play.plays = [event];
    function counts(report = html) {
      const template = document.createElement('template');
      template.innerHTML = report;
      const {even, pp, pk} = window.BangerGameLineups.observations(box, play, template.content);
      return [even, pp, pk].flatMap(pair => pair.map(team => team.length));
    }
    const cases = [counts(), counts(html.replace('awayTeam PlayerA','Former Player')), counts(html.replace('Game 0001','Game 0002'))];
    event.situationCode = '0541';
    cases.push(counts());
    event.situationCode = '1541';
    play.plays.push(event);
    cases.push(counts());
    play.plays = [event];
    play.rosterSpots[0].positionCode = 'D';
    try {
      counts();
      throw Error('Mismatched roster role was accepted');
    } catch (error) {
      if (error.message !== 'Nejednoznačná soupiska') throw error;
    }
    return cases;
  });
  assert.deepEqual(results[0], [0,0,1,0,0,1]);
  results.slice(1).forEach(actual => assert.deepEqual(actual, [0,0,0,0,0,0]));
};
