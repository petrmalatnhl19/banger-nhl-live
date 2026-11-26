// Match each published faceoff to the game roster and the NHL situation at that clock.
window.BangerGameLineups = (() => {
  const sides = ['awayTeam', 'homeTeam'];
  const normalize = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, '');

  function observations(box, play, report) {
    const result = { even: [[], []], pp: [[], []], pk: [[], []] };
    if (box.id !== play.id || !Array.isArray(play.rosterSpots)) return result;
    const info = Array.from(report.querySelectorAll('#GameInfo td'), cell => cell.textContent.trim());
    const day = new Date(box.gameDate + 'T12:00:00Z');
    if (!Number.isFinite(day.valueOf())) return result;
    const reportDate = day.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'});
    if (!info.includes(reportDate) || !info.includes('Game ' + String(box.id).slice(-4)) || !info.includes('Final')) return result;
    const ids = new Set();
    const role = position => ['C','L','R','LW','RW','F'].includes(position) ? 'F' : position;
    const rosters = sides.map(side => {
      const team = box[side];
      const entries = Object.values(box.playerByGameStats?.[side] || {}).flat();
      const map = new Map();
      for (const player of entries) {
        const spot = play.rosterSpots.find(p => p.teamId === team.id && p.playerId === player.playerId && p.sweaterNumber === player.sweaterNumber);
        if (!Number.isInteger(player.playerId) || player.playerId <= 0 || ids.has(player.playerId) ||
            !spot?.firstName?.default || !spot.lastName?.default || map.has(player.sweaterNumber) ||
            !['F','D','G'].includes(role(player.position)) || role(spot.positionCode) !== role(player.position)) {
          throw Error('Nejednoznačná soupiska');
        }
        ids.add(player.playerId);
        map.set(player.sweaterNumber, { ...player, full: spot.firstName.default + ' ' + spot.lastName.default });
      }
      return map;
    });
    const faceoffs = new Map();
    for (const event of play.plays || []) {
      if (event.typeDescKey !== 'faceoff') continue;
      const key = event.periodDescriptor.number + '/' + event.timeInPeriod;
      faceoffs.set(key, faceoffs.has(key) ? null : event);
    }
    const used = new Set();
    for (const row of report.querySelectorAll('tr')) {
      const cells = row.cells;
      if (cells.length !== 8 || cells[4].textContent.trim() !== 'FAC') continue;
      const clock = cells[3].firstChild?.textContent.trim().padStart(5, '0');
      const period = cells[1].textContent.trim();
      const key = (period === 'OT' ? '4' : period) + '/' + clock;
      const event = faceoffs.get(key);
      if (!event || used.has(key) || !/^1[3-5][3-5]1$/.test(event.situationCode)) continue;
      const counts = [Number(event.situationCode[1]), Number(event.situationCode[2])];
      const groups = sides.map((_, n) => Array.from(cells[n + 6].querySelectorAll('font[title]'), tag => {
        const player = rosters[n].get(Number(tag.textContent.trim()));
        return player && normalize(tag.title.split(' - ').slice(1).join(' - ')) === normalize(player.full) ? player : null;
      }));
      if (groups.some((group, n) => group.includes(null) || group.length !== counts[n] + 1 ||
          new Set(group).size !== group.length || group.filter(p => p.position === 'G').length !== 1)) continue;
      const { winningPlayerId, losingPlayerId } = event.details || {};
      const winner = groups.findIndex(group => group.some(p => p.playerId === winningPlayerId));
      if (winner < 0 || !groups[1 - winner].some(p => p.playerId === losingPlayerId)) continue;
      used.add(key);
      groups.forEach((group, n) => {
        const mode = counts[n] === counts[1-n] ? 'even' : counts[n] > counts[1-n] ? 'pp' : 'pk';
        if (mode === 'even' && counts[n] !== 5) return;
        result[mode][n].push({ clock: key, skaters: group.filter(p => p.position !== 'G') });
      });
    }
    return result;
  }

  function attach(root, box, rosterHtml, getPlay) {
    const buttons = Array.from(root.parentElement.querySelectorAll('[data-lineup-mode]'));
    let mode = 'even';
    let request;
    let observed;
    let failed = false;
    const final = ['OFF','FINAL'].includes(box.gameState);
    function render() {
      const panel = document.createElement('div');
      const note = document.createElement('p');
      note.className = 'actual-lineup-note';
      const rows = observed?.[mode];
      note.textContent = !final ? 'Kombinace při vhazování jsou dostupné až po konečném zápisu.' :
        !observed && !failed ? 'Načítám zápis vhazování…' :
        rows?.some(team => team.length) ? 'Hráči na ledě při vhazování podle NHL. Čas označuje okamžik ve třetině.' :
        'Pro tuto situaci nejsou ověřená vhazování k dispozici.';
      panel.append(note);
      if (mode !== 'even') {
        const ranking = document.createElement('p');
        ranking.textContent = mode === 'pp' ? 'Pořadí PP1 / PP2 není potvrzené.' : 'Pořadí PK1 / PK2 není potvrzené.';
        panel.append(ranking);
      }
      rows?.forEach((team, n) => {
        if (!team.length) return;
        const list = document.createElement('details');
        const title = document.createElement('summary');
        title.textContent = box[sides[n]].abbrev + ' · vhazování (' + team.length + ')';
        list.append(title);
        for (const {clock, skaters} of team) {
          const line = document.createElement('p');
          const [period, time] = clock.split('/');
          const names = players => players.map(p => p.full).join(' · ');
          const forwards = skaters.filter(p => p.position !== 'D');
          const defense = skaters.filter(p => p.position === 'D');
          const formation = mode === 'even' && forwards.length === 3 && defense.length === 2
            ? 'Útok: ' + names(forwards) + ' / Obrana: ' + names(defense) : names(skaters);
          line.textContent = period + '. tř. ' + time + ' · ' + formation;
          list.append(line);
        }
        panel.append(list);
      });
      root.innerHTML = mode === 'even' ? rosterHtml : '';
      root.prepend(panel);
    }
    function load() {
      if (!final || request) return;
      if (!/^\d{10}$/.test(box.id) || !/^\d{8}$/.test(box.season)) {
        failed = true;
        render();
        return;
      }
      const url = 'https://www.nhl.com/scores/htmlreports/' + box.season + '/PL' + String(box.id).slice(4) + '.HTM';
      request = Promise.all([getPlay(box.id), fetch(url, {signal: AbortSignal.timeout(12000)}).then(r => {
        if (!r.ok) throw Error('Zápis není dostupný');
        return r.text();
      })]).then(([play, html]) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        observed = observations(box, play, template.content);
      }).catch(() => { failed = true; }).finally(() => { if (root.isConnected) render(); });
    }
    buttons.forEach(button => {
      button.disabled = false;
      button.onclick = () => {
        mode = button.dataset.lineupMode;
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        render();
        load();
      };
    });
    render();
    const pane = root.closest('[data-match-pane]');
    const tab = document.querySelector('[data-match-tab="actual-lineups"]');
    tab?.addEventListener('click', load, {once: true});
    if (!pane?.classList.contains('hidden')) load();
  }
  return { attach, observations };
})();
