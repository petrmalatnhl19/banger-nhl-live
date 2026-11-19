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
      if (!section.dataset.fanLogoHeader) summary.textContent = selected ? '⭐ ' + byCode.get(selected)[1] : '⭐ Můj tým';
      section.open = false;
    });
    section.append(label, select);
    /* FAN-12: accessible searchable team gallery; native select remains as fallback. */
    if (typeof Event !== 'undefined' && typeof document.createElement('div').replaceChildren === 'function') {
    const gallery = document.createElement('div');
    gallery.className = 'fan-team-gallery';
    gallery.setAttribute('role', 'group');
    gallery.setAttribute('aria-label', 'Vybrat oblíbený tým NHL');
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Hledat tým NHL…';
    search.setAttribute('aria-label', 'Hledat tým NHL');
    const grid = document.createElement('div');
    grid.className = 'fan-team-grid';
    function renderTeams(query = '') {
      grid.replaceChildren();
      const filtered = TEAMS.filter(([code,name]) => (code + ' ' + name).toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
      for (const [code,name,color] of filtered) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'fan-team-choice';
        button.style.setProperty('--choice-accent',color);
        button.setAttribute('aria-pressed', String(selected === code));
        const logo = document.createElement('img');
        logo.src = 'https://assets.nhle.com/logos/nhl/svg/' + code + '_light.svg';
        logo.alt = '';
        logo.loading = 'lazy';
        logo.addEventListener('error', () => { logo.hidden = true; });
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        button.append(logo,nameSpan);
        button.addEventListener('click', () => {
          select.value = code;
          select.dispatchEvent(new Event('change', {bubbles:true}));
        });
        grid.appendChild(button);
      }
      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Žádný tým nenalezen.';
        grid.appendChild(empty);
      }
    }
    search.addEventListener('input', () => renderTeams(search.value));
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'fan-team-reset';
    reset.textContent = 'Bez oblíbeného týmu';
    reset.addEventListener('click', () => {
      select.value = '';
      select.dispatchEvent(new Event('change', {bubbles:true}));
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'fan-team-close';
    close.textContent = 'Zavřít ✕';
    close.setAttribute('aria-label', 'Zavřít výběr týmu');
    close.addEventListener('click', () => { section.open = false; });
    gallery.append(close,search,grid,reset);
    section.appendChild(gallery);
    section.addEventListener('toggle', () => {
      if (section.open) { search.value = ''; renderTeams(); }
    });
    renderTeams();
    }
    header.appendChild(section);
    apply(selected);
  }
  /* FAN-11: prominent, persistent team identity in the actual app header. */
  function updateTeamIdentity() {
    const header = document.querySelector('header.top');
    if (!header) return;
    let identity = document.getElementById('fanTeamIdentity');
    if (!identity) {
      identity = document.createElement('div');
      identity.id = 'fanTeamIdentity';
      identity.setAttribute('aria-live', 'polite');
      const brand = header.querySelector('.brand');
      if (brand) brand.insertAdjacentElement('afterend', identity);
      else header.prepend(identity);
    }
    identity.textContent = selected ? '★ ' + byCode.get(selected)[1] : '';
    identity.hidden = !selected;
  }
  document.addEventListener('banger:favorite-team-change', updateTeamIdentity);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateTeamIdentity, {once:true});
  else updateTeamIdentity();
  style.textContent += `
    body[data-fan-team] {
      --fan-surface:color-mix(in srgb,var(--fan-accent) 21%,#071729);
    }
    body[data-fan-team] header.top {
      background:linear-gradient(105deg,var(--fan-surface),#061322 88%)!important;
      border-bottom:3px solid var(--fan-accent)!important;
      box-shadow:0 7px 24px color-mix(in srgb,var(--fan-accent) 18%,transparent)!important;
    }
    #fanTeamIdentity[hidden]{display:none!important}
    #fanTeamIdentity {
      display:inline-flex;align-items:center;justify-content:center;
      padding:8px 12px;border:1px solid var(--fan-accent,#79e8ff);
      border-radius:999px;background:color-mix(in srgb,var(--fan-accent) 22%,#071729);
      color:#fff;font:800 12px Inter,system-ui,sans-serif;
      letter-spacing:.02em;text-align:center;
      box-shadow:0 0 16px color-mix(in srgb,var(--fan-accent) 23%,transparent);
    }
    body[data-fan-team] .toolbar .btn.active,
    body[data-fan-team] .toolbar .btn[id^="tab"].active,
    body[data-fan-team] #uxMobileNav .active,
    body[data-fan-team] #uxMobileNav [aria-current="page"] {
      background:linear-gradient(135deg,var(--fan-accent),color-mix(in srgb,var(--fan-accent) 55%,#092037))!important;
      border:2px solid var(--fan-accent)!important;
      color:#061322!important;
      box-shadow:0 3px 16px color-mix(in srgb,var(--fan-accent) 35%,transparent)!important;
    }
    body[data-fan-team] .toolbar .btn.active .nav-label,
    body[data-fan-team] #uxMobileNav .active .nav-label {color:#061322!important}
    body[data-fan-team] .dash-quick-btn {
      border-color:color-mix(in srgb,var(--fan-accent) 75%,#10263e)!important;
      background:linear-gradient(135deg,color-mix(in srgb,var(--fan-accent) 30%,#10263e),#09192d)!important;
      box-shadow:inset 0 2px color-mix(in srgb,var(--fan-accent) 45%,transparent)!important;
    }
    @media(max-width:600px) {
      #fanTeamIdentity {font-size:11px;padding:6px 9px;max-width:calc(100vw - 30px)}
      body[data-fan-team] header.top {gap:6px}
    }
    @media(forced-colors:active) {
      #fanTeamIdentity {border:2px solid Highlight}
      body[data-fan-team] .toolbar .btn.active {outline:2px solid Highlight}
    }
  `;
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
    body[data-fan-team] .analyst-list-card.fan-favorite-card,
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
    root.querySelectorAll('.game,.dash-game,.analyst-list-card').forEach(card=>{
      const names=Array.from(card.querySelectorAll('.analyst-teams strong,.dash-team-left b,.dash-team-right b,.dash-game-team,.dash-team,.team')).map(el=>el.textContent||'').join(' ');
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
  /* FAN-12: full-height searchable picker and team-colored identity. */
  style.textContent += `
    header.top .fan-team-picker[open] label,
    header.top .fan-team-picker[open] select {display:none!important}
    header.top .fan-team-picker .fan-team-gallery{display:none}
    header.top .fan-team-picker[open] .fan-team-gallery{
      display:flex;flex-direction:column;gap:12px;
      position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
      box-sizing:border-box;width:min(94vw,560px);max-height:min(80dvh,720px);
      padding:18px;border:2px solid var(--fan-accent,#79e8ff);
      border-radius:20px;background:#081b31;color:#fff;z-index:105;
      box-shadow:0 18px 65px #000b;
    }
    .fan-team-gallery input{flex:0 0 auto;width:100%;min-height:48px;
      padding:12px 15px;border-radius:12px;border:1px solid #62819a;
      background:#102b48;color:#fff;font-size:16px}
    .fan-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
      gap:9px;overflow-y:auto;min-height:0;padding:2px;overscroll-behavior:contain}
    .fan-team-choice{display:flex;align-items:center;gap:10px;text-align:left;
      min-height:64px;padding:9px;border:1px solid #345570;border-left:4px solid var(--choice-accent);
      border-radius:12px;background:#112b47;color:#fff;font:700 12px system-ui;cursor:pointer}
    .fan-team-choice img{width:36px;height:36px;object-fit:contain;flex:0 0 36px}
    .fan-team-choice[aria-pressed="true"]{background:color-mix(in srgb,var(--choice-accent) 30%,#112b47);
      border-color:var(--choice-accent)}
    .fan-team-close,.fan-team-reset{min-height:40px;border:1px solid #53738c;
      border-radius:10px;background:#173752;color:#fff;font:700 13px system-ui}
    .fan-team-close{align-self:flex-end;padding:8px 14px}
    .fan-team-reset{flex:0 0 auto}
    body[data-fan-team] .dash-game.fan-favorite-card,
    body[data-fan-team] .game.fan-favorite-card{
      border-left:5px solid var(--fan-accent)!important;
      background:linear-gradient(105deg,color-mix(in srgb,var(--fan-accent) 19%,#0b2037),#0b2037 75%)!important
    }
    @media(max-width:390px){.fan-team-choice{min-height:60px;font-size:11px;gap:6px}
      .fan-team-choice img{width:29px;height:29px;flex-basis:29px}}
    @media(forced-colors:active){.fan-team-choice[aria-pressed="true"]{outline:2px solid Highlight}}
  `;
  /* FAN-10: more visible team identity and spacious mobile team selection. */
  style.textContent += `
    body[data-fan-team] header.top {
      border-bottom:2px solid var(--fan-accent);
      background:linear-gradient(115deg,color-mix(in srgb,var(--fan-accent) 23%,#071729),#071729 65%);
    }
    body[data-fan-team] .toolbar>.btn.active,
    body[data-fan-team] #uxMobileNav [aria-current="page"],
    body[data-fan-team] #uxMobileNav .active,
    body[data-fan-team] .dash-quick-btn.active {
      background:linear-gradient(145deg,color-mix(in srgb,var(--fan-accent) 27%,#10263e),#10263e)!important;
      border-color:var(--fan-accent)!important;
      box-shadow:inset 0 -3px var(--fan-accent);
    }
    body[data-fan-team] .toolbar>.btn:focus-visible,
    body[data-fan-team] button:focus-visible,
    body[data-fan-team] select:focus-visible {
      outline:2px solid var(--fan-accent);
      outline-offset:2px;
    }
    body[data-fan-team] .dash-quick-btn:hover,
    body[data-fan-team] .toolbar>.btn:hover {
      border-color:var(--fan-accent);
    }
    header.top .fan-team-picker summary {
      max-width:210px;
      min-height:38px;
      display:flex;
      align-items:center;
      gap:6px;
      font-weight:750;
    }
    header.top .fan-team-picker[open]::before {
      content:"";
      position:fixed;
      inset:0;
      background:rgba(1,9,20,.78);
      z-index:99;
    }
    header.top .fan-team-picker[open] {z-index:100}
    header.top .fan-team-picker[open] summary {
      position:relative;
      z-index:101;
    }
    header.top .fan-team-picker[open] label {
      position:fixed;
      top:calc(50% - 160px);
      left:50%;
      right:auto;
      transform:translateX(-50%);
      box-sizing:border-box;
      width:min(90vw,420px);
      padding:20px 18px 14px;
      border:2px solid var(--fan-accent,#79e8ff);
      border-bottom:0;
      border-radius:18px 18px 0 0;
      color:#fff;
      font-size:18px;
      text-align:center;
      z-index:102;
    }
    header.top .fan-team-picker[open] select {
      position:fixed;
      top:calc(50% - 105px);
      left:50%;
      right:auto;
      transform:translateX(-50%);
      box-sizing:border-box;
      width:min(90vw,420px);
      max-width:420px;
      min-height:56px;
      padding:12px 18px;
      border:2px solid var(--fan-accent,#79e8ff);
      border-radius:0 0 18px 18px;
      font-size:16px;
      z-index:102;
    }
    @media(max-width:600px) {
      header.top .fan-team-picker summary {
        max-width:150px;
        min-height:38px;
        font-size:12px;
        padding:7px 10px;
      }
    }
    @media(prefers-reduced-motion:no-preference) {
      body[data-fan-team] header.top {transition:background .2s ease,border-color .2s ease}
    }
  `;
  /* FAN-13: keep brand and controls separate; distinguish teams with a second color. */
  const secondaryColors = {
    ANA:'#B9975B',BOS:'#111111',BUF:'#003087',CGY:'#F1BE48',
    CAR:'#111111',CHI:'#000000',COL:'#236192',CBJ:'#CE1126',
    DAL:'#006847',DET:'#FFFFFF',EDM:'#041E42',FLA:'#041E42',
    LAK:'#111111',MIN:'#154734',MTL:'#001E62',NSH:'#041E42',
    NJD:'#111111',NYI:'#00539B',NYR:'#CE1126',OTT:'#000000',
    PHI:'#000000',PIT:'#000000',SEA:'#001628',SJS:'#006D75',
    STL:'#002F87',TBL:'#002868',TOR:'#00205B',UTA:'#6CACE4',
    VAN:'#00205B',VGK:'#333F42',WSH:'#041E42',WPG:'#041E42'
  };
  function updateSecondaryColor() {
    const secondary = secondaryColors[selected];
    if (secondary) document.body.style.setProperty('--fan-secondary',secondary);
    else document.body.style.removeProperty('--fan-secondary');
  }
  document.addEventListener('banger:favorite-team-change',updateSecondaryColor);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',updateSecondaryColor,{once:true});
  else updateSecondaryColor();
  style.textContent += `
    /* Remove the duplicate team name introduced by FAN-11. */
    #fanTeamIdentity {display:none!important}
    header.top {box-sizing:border-box}
    header.top .brand {flex:0 0 auto;min-width:0;position:relative;z-index:1}
    header.top .fan-team-picker {min-width:0;flex:0 1 auto;z-index:2}
    header.top .fan-team-picker summary {box-sizing:border-box}
    body[data-fan-team] header.top {
      background:linear-gradient(110deg,#0a1c30 15%,color-mix(in srgb,var(--fan-secondary) 25%,#071729) 100%)!important;
      border-bottom:2px solid var(--fan-accent)!important;
      box-shadow:none!important;
    }
    body[data-fan-team] .fan-team-choice {
      border-left-color:var(--choice-accent);
    }
    body[data-fan-team] #uxMobileNav .active,
    body[data-fan-team] #uxMobileNav [aria-current="page"],
    body[data-fan-team] .toolbar .btn.active {
      color:#fff!important;
      background:linear-gradient(135deg,color-mix(in srgb,var(--fan-secondary) 78%,#112a40),#10243a)!important;
      border:2px solid var(--fan-accent)!important;
      box-shadow:inset 0 3px var(--fan-accent)!important;
    }
    body[data-fan-team] #uxMobileNav .active .nav-label,
    body[data-fan-team] .toolbar .btn.active .nav-label {color:#fff!important}
    @media(max-width:600px){
      header.top {display:flex!important;flex-wrap:wrap!important;gap:7px!important;padding:10px 12px!important;align-items:center!important}
      header.top .brand {flex:1 1 120px;max-width:160px}
      header.top .header-status {display:none!important}
      header.top .fan-team-picker {margin-left:auto!important;max-width:calc(100% - 130px)}
      header.top .fan-team-picker summary {max-width:100%!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    }
  `;
  /* FAN-19: restrained two-tone club identity; keep neutral content readable. */
  style.textContent += `
    body[data-fan-team] {
      --fan-soft:color-mix(in srgb,var(--fan-accent) 12%,#0c2840);
      --fan-edge:color-mix(in srgb,var(--fan-accent) 48%,#31536c);
    }
    body[data-fan-team] .game.fan-favorite-card,
    body[data-fan-team] .dash-game.fan-favorite-card,
    body[data-fan-team] .analyst-list-card.fan-favorite-card {
      background:linear-gradient(115deg,color-mix(in srgb,var(--fan-accent) 13%,#10283f) 0%,color-mix(in srgb,var(--fan-secondary) 12%,#0b2138) 70%,#0b2138 100%)!important;
      border-color:var(--fan-edge)!important;
      box-shadow:inset 4px 0 var(--fan-accent),0 0 12px color-mix(in srgb,var(--fan-accent) 10%,transparent)!important;
    }
    body[data-fan-team] .game.fan-favorite-card .btn,
    body[data-fan-team] .analyst-list-card.fan-favorite-card .btn {
      border-color:var(--fan-edge)!important;
      background:linear-gradient(130deg,color-mix(in srgb,var(--fan-secondary) 18%,#143452),#102b46)!important;
      color:#f2fbff!important;
    }
    body[data-fan-team] #uxStatsHub [data-ux-tab].active,
    body[data-fan-team] #uxStatsHub [data-ux-tab][aria-pressed="true"],
    body[data-fan-team] .ux-stats-tabs button.active {
      border-color:var(--fan-accent)!important;
      background:linear-gradient(135deg,color-mix(in srgb,var(--fan-secondary) 32%,#102d45),#10273e)!important;
      box-shadow:inset 3px 0 var(--fan-accent)!important;
      color:#fff!important;
    }
    body[data-fan-team] .fan-team-picker select:focus-visible,
    body[data-fan-team] #uxStatsHub [data-ux-tab]:focus-visible {
      outline:2px solid var(--fan-accent)!important;
      outline-offset:2px;
    }
    @media(prefers-reduced-motion:reduce) {
      body[data-fan-team] .game.fan-favorite-card,
      body[data-fan-team] .dash-game.fan-favorite-card {transition:none!important}
    }
    @media(forced-colors:active) {
      body[data-fan-team] .game.fan-favorite-card,
      body[data-fan-team] .dash-game.fan-favorite-card {outline:2px solid Highlight}
    }
  `;
  /* FAN-14: two-row mobile header; team name never clipped by language control. */
  style.textContent += `
    @media(max-width:600px) {
      header.top {
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        grid-template-rows:auto auto!important;
        align-items:center!important;
        column-gap:10px!important;
        row-gap:10px!important;
        padding:12px!important;
      }
      header.top .brand {
        grid-column:1!important;grid-row:1!important;
        width:auto!important;max-width:100%!important;
        min-width:0!important;justify-self:start!important;
      }
      header.top .fan-team-picker {
        grid-column:1 / -1!important;grid-row:2!important;
        margin:0!important;max-width:100%!important;width:100%!important;
      }
      header.top .fan-team-picker summary {
        display:flex!important;align-items:center!important;
        box-sizing:border-box!important;max-width:100%!important;
        width:100%!important;min-height:43px!important;
        padding:10px 14px!important;font-size:14px!important;
        text-overflow:clip!important;white-space:normal!important;
        overflow-wrap:anywhere!important;
        border-radius:12px!important;
      }
      header.top .header-status{display:none!important}
      header.top #bangerLanguageBox,header.top .lang-picker,header.top .language-picker,
      header.top .lang-switch,header.top .language-switch,
      header.top #languageSelector {
        grid-column:2!important;grid-row:1!important;justify-self:end!important;
      }
      body[data-fan-team] #uxMobileNav .active,
      body[data-fan-team] #uxMobileNav [aria-current="page"] {
        border:1px solid color-mix(in srgb,var(--fan-accent) 65%,#30445c)!important;
        box-shadow:inset 0 2px var(--fan-accent)!important;
        background:linear-gradient(180deg,color-mix(in srgb,var(--fan-secondary) 38%,#10243a),#10243a)!important;
      }
    }
  `;
  /* FAN-14: on short screens, reveal the first statistics row above fixed nav.
     Only runs after the user explicitly opens the Statistics tab. */
  function installShortScreenStatsReveal() {
    const nav = document.getElementById('uxMobileNav');
    if (!nav || nav.dataset.fanStatsReveal) return;
    nav.dataset.fanStatsReveal = '1';
    nav.addEventListener('click', event => {
      if (!event.target.closest('[data-ux-tab="skaters"]') || window.innerHeight > 600) return;
      let attempts = 0;
      function reveal() {
        const row = document.querySelector('#content .stats-tablewrap tbody tr');
        const bar = document.getElementById('uxMobileNav');
        if (!row || !bar) {
          if (++attempts < 40) requestAnimationFrame(reveal);
          return;
        }
        const bottom = row.getBoundingClientRect().bottom;
        const top = bar.getBoundingClientRect().top;
        if (bottom > top - 10) {
          window.scrollBy({top:Math.ceil(bottom - top + 18),behavior:'instant'});
        }
      }
      requestAnimationFrame(reveal);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installShortScreenStatsReveal,{once:true});
  else installShortScreenStatsReveal();
  /* FAN-15: one-row mobile header: brand | selected club logo | language flag. */
  function mountCompactHeader() {
    const header = document.querySelector('header.top');
    if (!header) return;
    const picker = header.querySelector('.fan-team-picker');
    if (picker && !picker.dataset.fanLogoHeader) {
      picker.dataset.fanLogoHeader = '1';
      const summary = picker.querySelector('summary');
      if (summary) {
        summary.setAttribute('aria-label','Změnit oblíbený tým NHL');
        function renderHeaderLogo() {
          summary.replaceChildren();
          const img = document.createElement('img');
          img.className = 'fan-header-club-logo';
          img.alt = selected ? byCode.get(selected)[1] : '';
          img.src = selected
            ? 'https://assets.nhle.com/logos/nhl/svg/' + selected + '_light.svg'
            : '';
          img.hidden = !selected;
          const fallback = document.createElement('span');
          fallback.className = 'fan-header-club-fallback';
          fallback.textContent = selected ? byCode.get(selected)[0] : '★';
          fallback.hidden = !!selected;
          img.addEventListener('error', () => {img.hidden = true; fallback.hidden = false;});
          const sr = document.createElement('span');
          sr.className = 'fan-header-sr';
          sr.textContent = selected ? byCode.get(selected)[1] : 'Vybrat tým';
          summary.append(img,fallback,sr);
        }
        document.addEventListener('banger:favorite-team-change',renderHeaderLogo);
        renderHeaderLogo();
      }
    }
    const language = document.getElementById('bangerLanguageBox');
    if (language && !language.dataset.fanFlagHeader) {
      language.dataset.fanFlagHeader = '1';
      const flag = document.createElement('span');
      flag.className = 'fan-header-language-flag';
      flag.setAttribute('aria-hidden','true');
      const select = language.querySelector('select');
      function updateFlag() { flag.textContent = select && select.value === 'en' ? '🇬🇧' : '🇨🇿'; }
      updateFlag();
      if (select) select.addEventListener('change',updateFlag);
      language.appendChild(flag);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mountCompactHeader,{once:true});
  else mountCompactHeader();
  document.addEventListener('banger:favorite-team-change',mountCompactHeader);
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      mountCompactHeader();
      if (document.querySelector('header.top #bangerLanguageBox')?.dataset.fanFlagHeader) observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  style.textContent += `
    .fan-header-sr{position:absolute!important;width:1px;height:1px;padding:0;
      margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .fan-header-club-logo{display:block;width:55px;height:48px;object-fit:contain}
    .fan-header-club-logo[hidden],.fan-header-club-fallback[hidden]{display:none!important}
    .fan-header-club-fallback{font-size:22px;font-weight:900;color:#fff}
    @media(max-width:600px) {
      header.top{
        display:grid!important;grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr)!important;
        grid-template-rows:auto!important;gap:6px!important;
        align-items:center!important;min-height:74px!important;padding:8px 12px!important;
      }
      header.top .brand{grid-column:1!important;grid-row:1!important;max-width:100%!important;
        min-width:0!important;justify-self:start!important}
      header.top .fan-team-picker{grid-column:2!important;grid-row:1!important;
        width:72px!important;max-width:72px!important;margin:0!important;justify-self:center!important}
      header.top .fan-team-picker summary{display:flex!important;align-items:center!important;
        justify-content:center!important;width:72px!important;max-width:72px!important;
        height:60px!important;min-height:60px!important;padding:4px!important;
        box-sizing:border-box!important;overflow:hidden!important;border-radius:13px!important;
        background:transparent!important;border:0!important;box-shadow:none!important;
        outline:0!important}
      header.top .fan-team-picker summary:focus-visible{
        outline:2px solid #79e8ff!important;outline-offset:3px!important;
        border-radius:12px!important;
      }
      header.top #bangerLanguageBox{grid-column:3!important;grid-row:1!important;
        justify-self:end!important;position:relative!important;
        width:52px!important;height:48px!important;padding:0!important;
        box-sizing:border-box!important;display:flex!important;align-items:center!important;
        justify-content:center!important}
      header.top #bangerLanguageBox label{display:none!important}
      header.top #bangerLanguageBox select{position:absolute!important;inset:0!important;
        width:100%!important;height:100%!important;opacity:0!important;cursor:pointer!important;
        z-index:2!important}
      .fan-header-language-flag{font-size:26px;line-height:1}
      header.top .header-status{display:none!important}
      body[data-fan-team] header.top{border-bottom:2px solid var(--fan-accent)!important}
    }
  `;
  /* FAN-20: borderless language flag in the mobile header; retain select hit area. */
  style.textContent += `
    @media(max-width:600px) {
      header.top #bangerLanguageBox,
      body[data-fan-team] header.top #bangerLanguageBox {
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        background-image:none!important;
        box-shadow:none!important;
        outline:0!important;
      }
      header.top #bangerLanguageBox .fan-header-language-flag {
        border:0!important;
        background:transparent!important;
        box-shadow:none!important;
        pointer-events:none!important;
      }
      header.top #bangerLanguageBox:focus-within {
        outline:2px solid #79e8ff!important;
        outline-offset:2px!important;
        border-radius:8px!important;
      }
    }
  `;
  /* FAN-17: consistent two-color team identity across interactive controls.
     Preserve neutral inactive controls and distinct live/error states. */
  style.textContent += `
    body[data-fan-team] {
      --fan-control-bg:color-mix(in srgb,var(--fan-secondary,#10283f) 38%,#0b2036);
      --fan-control-border:color-mix(in srgb,var(--fan-accent) 75%,#34526c);
    }
    body[data-fan-team] .ux-stats-tabs button.active,
    body[data-fan-team] .ux-stats-tabs button[aria-selected="true"],
    body[data-fan-team] .ux-stats-tabs button[aria-pressed="true"],
    body[data-fan-team] .dash-quick-btn.active,
    body[data-fan-team] .toolbar>.btn.active,
    body[data-fan-team] #uxMobileNav .active,
    body[data-fan-team] #uxMobileNav [aria-current="page"] {
      background:linear-gradient(145deg,var(--fan-control-bg),#0b2036)!important;
      border-color:var(--fan-control-border)!important;
      box-shadow:inset 0 3px var(--fan-accent)!important;
      color:#fff!important;
    }
    body[data-fan-team] .ux-stats-tabs button.active *,
    body[data-fan-team] .toolbar>.btn.active *,
    body[data-fan-team] #uxMobileNav .active * {color:#fff!important}
    body[data-fan-team] .ux-action,
    body[data-fan-team] .dash-quick-btn,
    body[data-fan-team] .stats-controls button:not(.active) {
      border-color:color-mix(in srgb,var(--fan-accent) 35%,#34526c)!important;
      background:linear-gradient(125deg,color-mix(in srgb,var(--fan-secondary,#10283f) 22%,#0d2941),#0d2941)!important;
    }
    body[data-fan-team] .fan-favorite-advanced-row {
      background:linear-gradient(90deg,color-mix(in srgb,var(--fan-accent) 19%,#10283f),color-mix(in srgb,var(--fan-secondary,#10283f) 22%,#10283f))!important;
      box-shadow:inset 4px 0 var(--fan-accent)!important;
    }
    /* FAN-18: paint cells, not only the row: sticky first columns have opaque backgrounds. */
    body[data-fan-team] .adv-table tbody tr.fan-favorite-advanced-row > td,
    body[data-fan-team] .stats-tablewrap tbody tr.fan-favorite-row > td {
      background-color:color-mix(in srgb,var(--fan-accent) 14%,#0b2036)!important;
      background-image:linear-gradient(90deg,color-mix(in srgb,var(--fan-accent) 7%,transparent),transparent)!important;
    }
    body[data-fan-team] .adv-table tbody tr.fan-favorite-advanced-row > td:first-child,
    body[data-fan-team] .stats-tablewrap tbody tr.fan-favorite-row > td:first-child {
      box-shadow:inset 4px 0 var(--fan-accent)!important;
    }
    body[data-fan-team] .adv-table tbody tr.fan-favorite-advanced-row > td:is(:first-child,:nth-child(2)),
    body[data-fan-team] .stats-tablewrap tbody tr.fan-favorite-row > td:nth-child(2) .playerlink {
      color:var(--fan-accent)!important;
      font-weight:800!important;
    }
    body[data-fan-team] .adv-table tbody tr.fan-favorite-advanced-row > td:first-child {
      position:sticky;
      left:0;
      z-index:2;
    }
    @media(forced-colors:active) {
      body[data-fan-team] .adv-table tbody tr.fan-favorite-advanced-row > td:first-child {outline:2px solid Highlight}
    }
    body[data-fan-team] .adv-podium-card.fan-favorite-advanced-row,
    body[data-fan-team] .adv-rank-row.fan-favorite-advanced-row {
      border:1px solid var(--fan-accent)!important;
      border-left:4px solid var(--fan-accent)!important;
      border-radius:10px;
      background:linear-gradient(110deg,color-mix(in srgb,var(--fan-accent) 18%,#10283f),color-mix(in srgb,var(--fan-secondary,#10283f) 24%,#10283f))!important;
      box-shadow:inset 0 1px color-mix(in srgb,var(--fan-accent) 25%,transparent)!important;
    }
    body[data-fan-team] .fan-favorite-advanced-row td:first-child {
      color:#fff!important;font-weight:800!important;
    }
    body[data-fan-team] .fan-favorite-advanced-row td:nth-child(2) {
      color:var(--fan-accent)!important;font-weight:750!important;
    }
    @media(forced-colors:active) {
      body[data-fan-team] .fan-favorite-advanced-row {outline:2px solid Highlight}
    }
  `;
  /* FAN-21 / Arena Experience 2.0: CSS-only arena atmosphere; no network assets.
     Keep tables readable and all decorations outside interactive hit targets. */
  const ARENA_KEY = 'banger-fan-arena-v1';
  let arenaEnabled = true;
  try { arenaEnabled = localStorage.getItem(ARENA_KEY) !== 'off'; } catch (_) {}
  function syncArena() {
    if (arenaEnabled && selected) document.body.dataset.fanArena = 'on';
    else delete document.body.dataset.fanArena;
    const control = document.getElementById('fanArenaToggle');
    if (control) {
      control.setAttribute('aria-pressed', String(arenaEnabled));
      control.textContent = arenaEnabled ? '✦ Arena: zapnuto' : '✦ Arena: vypnuto';
    }
  }
  function mountArenaToggle() {
    const picker = document.querySelector('header.top .fan-team-picker');
    if (!picker || document.getElementById('fanArenaToggle')) return;
    const control = document.createElement('button');
    control.id = 'fanArenaToggle';
    control.type = 'button';
    control.className = 'fan-arena-toggle';
    control.setAttribute('aria-label', 'Zapnout nebo vypnout atmosféru arény');
    control.addEventListener('click', () => {
      arenaEnabled = !arenaEnabled;
      try { localStorage.setItem(ARENA_KEY, arenaEnabled ? 'on' : 'off'); } catch (_) {}
      syncArena();
    });
    picker.appendChild(control);
    syncArena();
  }
  document.addEventListener('banger:favorite-team-change',syncArena);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mountArenaToggle(); syncArena(); }, {once:true});
  else { mountArenaToggle(); syncArena(); }
  style.textContent += `
    /* Keep the expanded team picker above the main content in Arena mode. */
    body[data-fan-arena="on"] header.top:has(.fan-team-picker[open]) {
      position:relative;
      z-index:200!important;
    }
    .fan-arena-toggle {
      display:block;position:relative;z-index:3;margin:8px 0 2px;
      padding:7px 10px;max-width:100%;border:1px solid var(--fan-accent,#49748d);
      border-radius:9px;background:#0a2236;color:#fff;font:600 11px Inter,system-ui,sans-serif;
      cursor:pointer;
    }
    .fan-arena-toggle:focus-visible {outline:2px solid #79e8ff;outline-offset:3px}
    body[data-fan-team][data-fan-arena="on"] {
      --arena-glow:color-mix(in srgb,var(--fan-accent) 24%,transparent);
      background-color:#061320!important;
      background-image:
        radial-gradient(ellipse 100% 260px at 50% 0%,color-mix(in srgb,var(--fan-accent) 17%,transparent),transparent 75%),
        linear-gradient(165deg,color-mix(in srgb,var(--fan-secondary) 18%,#061320),#061320 55%)!important;
      background-attachment:scroll!important;
    }
    body[data-fan-team][data-fan-arena="on"] header.top {
      isolation:isolate;
      background:linear-gradient(115deg,color-mix(in srgb,var(--fan-secondary) 60%,#061320),color-mix(in srgb,var(--fan-accent) 18%,#061320))!important;
      border-bottom:2px solid var(--fan-accent)!important;
    }
    body[data-fan-team][data-fan-arena="on"] header.top::before {
      content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
      background:repeating-linear-gradient(112deg,transparent 0 28px,color-mix(in srgb,var(--fan-accent) 8%,transparent) 29px 31px,transparent 32px 68px);
      opacity:.65;
    }
    body[data-fan-team][data-fan-arena="on"] :is(.game,.dash-game,.analyst-list-card) {
      border-color:color-mix(in srgb,var(--fan-accent) 24%,#284057)!important;
    }
    body[data-fan-team][data-fan-arena="on"] :is(.game,.dash-game,.analyst-list-card).fan-favorite-card {
      border-color:var(--fan-accent)!important;
      box-shadow:inset 4px 0 var(--fan-accent),0 0 20px var(--arena-glow)!important;
    }
    body[data-fan-team][data-fan-arena="on"] #uxMobileNav {
      border-top:2px solid color-mix(in srgb,var(--fan-accent) 55%,#0d263c)!important;
      background:linear-gradient(100deg,color-mix(in srgb,var(--fan-secondary) 30%,#071a2a),#071a2a)!important;
    }
    body[data-fan-team][data-fan-arena="on"] :is(.toolbar,.stats-tablewrap,.adv-table) {
      accent-color:var(--fan-accent);
    }
    @media(max-width:600px) {
      header.top .fan-team-picker[open] .fan-arena-toggle {position:relative;top:auto;right:auto;margin:6px 0 0;font-size:11px;padding:7px 10px}
    }
    @media(prefers-reduced-motion:reduce) {
      body[data-fan-arena="on"] *,body[data-fan-arena="on"] *::before,
      body[data-fan-arena="on"] *::after {animation:none!important;transition-duration:0s!important}
    }
    @media(forced-colors:active) {
      body[data-fan-arena="on"] .fan-arena-toggle {border:1px solid ButtonText}
      body[data-fan-arena="on"] header.top::before {display:none}
    }
  `;
  /* Advanced statistics use different table markup than .stats-tablewrap.
     Resolve the team column from headings, never assume fixed column 3. */
  function markAdvancedFavoritePlayers() {
    const root=document.getElementById('content');
    if(!root)return;
    const team=selected;
    root.querySelectorAll('table').forEach(table=>{
      if(table.closest('.stats-tablewrap'))return;
      const heads=Array.from(table.querySelectorAll('thead th'));
      const teamColumn=heads.findIndex(h=>/^(tým|team|tm|klub)$/i.test((h.textContent||'').trim()));
      if(teamColumn<0)return;
      table.querySelectorAll('tbody tr').forEach(row=>{
        const cell=row.cells?.[teamColumn];
        const codes=(cell?.textContent||'').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
        const match=Boolean(team&&codes.includes(team));
        row.classList.toggle('fan-favorite-advanced-row',match);
        if(match)row.setAttribute('data-fan-highlight','favorite-team');
        else row.removeAttribute('data-fan-highlight');
      });
    });
  }
  document.addEventListener('banger:favorite-team-change',markAdvancedFavoritePlayers);
  function watchAdvancedFavoritePlayers(){
    const root=document.getElementById('content');
    if(!root)return;
    if(typeof MutationObserver!=='undefined')
      new MutationObserver(markAdvancedFavoritePlayers).observe(root,{childList:true,subtree:true});
    markAdvancedFavoritePlayers();
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',watchAdvancedFavoritePlayers,{once:true});
  else watchAdvancedFavoritePlayers();
})();
