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
  style.textContent += `
    header.top{position:relative}
    header.top .fan-team-picker{display:block;position:relative;margin:0;padding:0;border:0;flex:0 0 auto}
    header.top .fan-team-picker summary{cursor:pointer;list-style:none;padding:7px 10px;border:1px solid #49748d;border-radius:10px;background:#0d2848;color:#e6fbff;max-width:165px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    header.top .fan-team-picker summary::-webkit-details-marker{display:none}
    header.top .fan-team-picker[open]{z-index:25}
    header.top .fan-team-picker label,header.top .fan-team-picker select{position:absolute;right:0;z-index:26;background:#0d2848}
    header.top .fan-team-picker label{top:100%;width:200px;padding:8px 10px 0;border:1px solid #49748d;border-bottom:0;border-radius:10px 10px 0 0}
    header.top .fan-team-picker select{top:calc(100% + 29px);width:200px;max-width:200px;border-radius:0 0 10px 10px}
    @media(max-width:600px){header.top .fan-team-picker summary{max-width:120px;font-size:11px;padding:6px 8px}}
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
    const section = document.createElement('details');
    section.className = 'fan-team-picker';
    const summary = document.createElement('summary');
    summary.textContent = selected ? '⭐ ' + byCode.get(selected)[1] : '⭐ Můj tým';
    section.appendChild(summary);
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
      summary.textContent = selected ? '⭐ ' + byCode.get(selected)[1] : '⭐ Můj tým';
      section.open = false;
    });
    section.append(label, select);
    header.appendChild(section);
    apply(selected);
  }
  window.BangerFavoriteTeam = Object.freeze({get:() => selected, teams:TEAMS.map(([code,name])=>({code,name}))});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
  /* FAN-03: highlight matching players in the existing skater/goalie tables.
     Keep the original ranking and sorting untouched. */
  style.textContent += `
    body[data-fan-team] .stats-tablewrap tbody tr.fan-favorite-row {
      background:color-mix(in srgb,var(--fan-accent) 17%,transparent);
      box-shadow:inset 3px 0 var(--fan-accent);
    }
    body[data-fan-team] .stats-tablewrap tbody tr.fan-favorite-row td:nth-child(2) .playerlink {
      color:var(--fan-accent);font-weight:750;
    }
    @media(forced-colors:active) {
      body[data-fan-team] .stats-tablewrap tbody tr.fan-favorite-row {outline:2px solid Highlight}
    }
  `;
  function markFavoriteStats() {
    const root=document.getElementById('content');
    if(!root)return;
    const team=selected;
    root.querySelectorAll('.stats-tablewrap tbody tr').forEach(row=>{
      const teamCell=row.cells?.[2];
      const codes=(teamCell?.textContent||'').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
      const match=Boolean(team&&codes.includes(team));
      row.classList.toggle('fan-favorite-row',match);
      if(match)row.setAttribute('aria-label','Hráč oblíbeného týmu '+byCode.get(team)[1]);
      else row.removeAttribute('aria-label');
    });
  }
  document.addEventListener('banger:favorite-team-change',markFavoriteStats);
  function watchStats() {
    const root=document.getElementById('content');
    if(!root)return;
    new MutationObserver(markFavoriteStats).observe(root,{childList:true,subtree:true});
    markFavoriteStats();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchStats,{once:true});
  else watchStats();
  /* FAN-04: decorate existing game and news cards without altering NHL feeds. */
  style.textContent += `
    body[data-fan-team] .game.fan-favorite-card,
    body[data-fan-team] .dash-game.fan-favorite-card,
    body[data-fan-team] .banger-news-card.fan-favorite-card {
      border-color:var(--fan-accent)!important;
      box-shadow:inset 3px 0 var(--fan-accent),0 0 14px color-mix(in srgb,var(--fan-accent) 15%,transparent);
    }
    body[data-fan-team] .banger-news-card.fan-favorite-card .banger-news-source {
      color:var(--fan-accent);
    }
  `;
  function markFavoriteCards() {
    const root=document.getElementById('content');
    if(!root)return;
    const team=selected;
    root.querySelectorAll('.game,.dash-game').forEach(card=>{
      const names=Array.from(card.querySelectorAll('.analyst-teams strong,.dash-game-teams,.dash-game-team,.dash-team,.team')).map(el=>el.textContent||'').join(' ');
      const codes=names.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
      const match=Boolean(team&&codes.includes(team));
      card.classList.toggle('fan-favorite-card',match);
    });
    root.querySelectorAll('.banger-news-card').forEach(card=>{
      const codes=Array.from(card.querySelectorAll('.banger-news-crest[alt]')).map(img=>img.getAttribute('alt')?.toUpperCase());
      card.classList.toggle('fan-favorite-card',Boolean(team&&codes.includes(team)));
    });
  }
  document.addEventListener('banger:favorite-team-change',markFavoriteCards);
  function watchFavoriteCards() {
    const root=document.getElementById('content');
    if(!root)return;
    new MutationObserver(markFavoriteCards).observe(root,{childList:true,subtree:true});
    markFavoriteCards();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchFavoriteCards,{once:true});
  else watchFavoriteCards();
}
  /* FAN-05: restrained team accent across navigation and controls.
     Preserve dark surfaces, readable text, live-state colors and mobile sizes. */
  style.textContent += `
    body[data-fan-team] header.top .fan-team-picker summary {
      border-color:var(--fan-accent);
      box-shadow:inset 3px 0 var(--fan-accent);
    }
    body[data-fan-team] .toolbar>.btn[id^="tab"].active {
      border-color:var(--fan-accent);
      box-shadow:inset 0 1px #ffffff40,0 0 0 1px var(--fan-accent);
    }
    body[data-fan-team] .toolbar>.btn[id^="tab"].active:after {
      background:var(--fan-accent);
      box-shadow:0 0 10px var(--fan-accent);
    }
    body[data-fan-team] .toolbar>.btn[id^="tab"].active .nav-icon-3d {
      border-color:var(--fan-accent);
    }
    body[data-fan-team] .dash-quick-btn:focus-visible,
    body[data-fan-team] .toolbar>.btn:focus-visible,
    body[data-fan-team] .fan-team-picker summary:focus-visible {
      outline:2px solid var(--fan-accent);
      outline-offset:3px;
    }
    body[data-fan-team] .dash-quick-btn:hover {
      border-color:var(--fan-accent);
    }
    @media(forced-colors:active) {
      body[data-fan-team] .toolbar>.btn[id^="tab"].active {
        outline:2px solid Highlight;
      }
    }
  `;
})();
