/* FAN-02: Favorite NHL team preference, independent of prediction CORE. */
(function () {
  'use strict';
  const KEY = 'banger-favorite-team-v1';
  const TEAMS = [
    ['ANA','Anaheim Ducks','#F47A38'],['BOS','Boston Bruins','#FFB81C'],
    ['BUF','Buffalo Sabres','#FCB514'],['CGY','Calgary Flames','#D2001C'],
    ['CAR','Carolina Hurricanes','#CC0000'],['CHI','Chicago Blackhawks','#CF0A2C'],
    ['COL','Colorado Avalanche','#8A2432'],['CBJ','Columbus Blue Jackets','#5A9BD4'],
    ['DAL','Dallas Stars','#8FCEAE'],['DET','Detroit Red Wings','#CE1126'],
    ['EDM','Edmonton Oilers','#FF7C1F'],['FLA','Florida Panthers','#C8102E'],
    ['LAK','Los Angeles Kings','#A2AAAD'],['MIN','Minnesota Wild','#A6192E'],
    ['MTL','Montréal Canadiens','#AF1E2D'],['NSH','Nashville Predators','#FFB81C'],
    ['NJD','New Jersey Devils','#CE1126'],['NYI','New York Islanders','#F47D30'],
    ['NYR','New York Rangers','#2B75D6'],['OTT','Ottawa Senators','#C99A32'],
    ['PHI','Philadelphia Flyers','#F74902'],['PIT','Pittsburgh Penguins','#FCB514'],
    ['SEA','Seattle Kraken','#72C7E7'],['SJS','San Jose Sharks','#6CC6CA'],
    ['STL','St. Louis Blues','#4D9ED8'],['TBL','Tampa Bay Lightning','#5B9FE8'],
    ['TOR','Toronto Maple Leafs','#6CA9F5'],['UTA','Utah Mammoth','#8DB6DC'],
    ['VAN','Vancouver Canucks','#68B8A2'],['VGK','Vegas Golden Knights','#BFA56A'],
    ['WSH','Washington Capitals','#C8102E'],['WPG','Winnipeg Jets','#6D9BC2']
  ];
  const byCode = new Map(TEAMS.map(t => [t[0], t]));
  const read = () => { try { const v = localStorage.getItem(KEY); return byCode.has(v) ? v : ''; } catch (_) { return ''; } };
  let selected = read();
  const style = document.createElement('style');
  style.textContent = `
    .fan-team-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 12px;font:600 12px Inter,system-ui,sans-serif;color:#b9d7e9}
    .fan-team-picker select{min-width:155px;max-width:240px;padding:8px 10px;border-radius:10px;border:1px solid #49748d;background:#0d2848;color:#fff;font:inherit}
    .fan-team-picker select:focus-visible{outline:2px solid #79e8ff;outline-offset:2px}
    body[data-fan-team] .fan-team-picker{border-left:3px solid var(--fan-accent);padding-left:10px}
    body[data-fan-team] .fan-team-picker strong{color:var(--fan-accent)}
    @media(max-width:390px){.fan-team-picker{font-size:11px}.fan-team-picker select{min-width:135px;max-width:185px}}
  `;
  document.head.appendChild(style);
  function apply(code) {
    selected = byCode.has(code) ? code : '';
    if (selected) {
      document.body.dataset.fanTeam = selected;
      document.body.style.setProperty('--fan-accent', byCode.get(selected)[2]);
    } else {
      delete document.body.dataset.fanTeam;
      document.body.style.removeProperty('--fan-accent');
    }
    document.dispatchEvent(new CustomEvent('banger:favorite-team-change', {detail:{team:selected}}));
  }
  function mount() {
    const header = document.querySelector('header.top');
    if (!header || document.getElementById('fanTeamSelect')) return;
    const section = document.createElement('div');
    section.className = 'fan-team-picker';
    const label = document.createElement('label');
    label.htmlFor = 'fanTeamSelect';
    label.textContent = '⭐ Můj tým';
    const select = document.createElement('select');
    select.id = 'fanTeamSelect';
    select.setAttribute('aria-label', 'Vyberte svůj oblíbený tým NHL');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Bez oblíbeného týmu';
    select.appendChild(none);
    for (const [code,name] of TEAMS) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      select.appendChild(option);
    }
    select.value = selected;
    select.addEventListener('change', () => {
      try { if (select.value) localStorage.setItem(KEY, select.value); else localStorage.removeItem(KEY); } catch (_) {}
      apply(select.value);
    });
    section.append(label, select);
    header.insertAdjacentElement('afterend', section);
    apply(selected);
  }
  window.BangerFavoriteTeam = Object.freeze({get:() => selected, teams:TEAMS.map(([code,name])=>({code,name}))});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
