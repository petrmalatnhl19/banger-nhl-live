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
  // Render the actual projection function with isolated, fresh fixtures.
  const projections = await page.evaluate(async () => {
    const oldFetch = window.fetch;
    const root = document.createElement('div');
    root.id = 'lineupProjection';
    root.style.width = '100%';
    document.body.append(root);
    const f = [['A One','B Two','C Three'],['D Four','E Five','F Six'],['G Seven','H Eight','I Nine']];
    const d = [['J Ten','K Eleven'],['L Twelve','M Thirteen'],['N Fourteen','O Fifteen']];
    const base = {publishedAt:new Date().toISOString(),forwards:f,defense:d,goalies:[]};
    const teams = {
      blackhawks:{...base,forwards:[...f,['P Sixteen','Q Seventeen','R Eighteen']]},
      jets:{...base,projectedAlignment:{forwards:11,defense:7,extraForwardUnit:['Cole Koepke','Morgan Barron'],extraDefenders:['Tyrel Bauer']}},
      flames:{...base,partialFormations:[{group:'forwards',verifiedPlayers:['Brennan Othmann','Maxim Tsyplakov']}]},
      devils:{...base,forwards:[...f,['P Sixteen','Q Seventeen','R Eighteen']],defense:d.slice(0,2),partialFormations:[{group:'defense',verifiedPlayers:['Declan Chisholm']}]}
    };
    window.fetch = async url => ({ok:true,json:async()=>String(url).includes('./lineups.json?')?{fetchedAt:new Date().toISOString(),rosterValidated:true,teams}:{}});
    try {
      const results=[];
      for(const [away,home] of [['CHI','WPG'],['CGY','NJD']]){
        await loadLineupProjection({gameState:'FUT',awayTeam:{abbrev:away},homeTeam:{abbrev:home}});
        results.push({text:root.innerText,overflow:root.scrollWidth>root.clientWidth+2});
      }
      return results;
    } finally {window.fetch=oldFetch;root.remove();}
  });
  assert.match(projections[0].text,/Projekce 11\+7/);
  assert.match(projections[0].text,/Tyrel Bauer/);
  assert.match(projections[0].text,/Cole Koepke/);
  assert.doesNotMatch(projections[0].text,/Neúplná projekce/);
  assert.match(projections[1].text,/Neúplná projekce/);
  assert.match(projections[1].text,/Brennan Othmann/);
  assert.match(projections[1].text,/Declan Chisholm/);
  assert.equal(projections.some(x=>x.overflow),false);
};
