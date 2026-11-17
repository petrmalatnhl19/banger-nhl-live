// FAN-06: offline preference and renderer regression checks. Run: node tests/favorite-team.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../favorite-team.js'),'utf8');
function fixture(saved='') {
  const listeners = new Map(), storage = new Map(saved?[['banger-favorite-team-v1',saved]]:[]);
  const classes = () => { const set = new Set(); return {toggle:(name,on)=>on?set.add(name):set.delete(name),contains:name=>set.has(name)}; };
  const make = tag => ({
    tagName:tag,children:[],classList:classes(),style:{setProperty(){},removeProperty(){}},
    dataset:{},attributes:{},appendChild(child){this.children.push(child);},
    prepend(child){this.children.unshift(child);},
    querySelector(){return null;},
    insertAdjacentElement(position,child){if(position==='afterend')this.children.push(child);},
    append(...children){this.children.push(...children);},
    prepend(...children){this.children.unshift(...children);},
    addEventListener(name,fn){this['on'+name]=fn;},
    setAttribute(name,value){this.attributes[name]=value;},
    removeAttribute(name){delete this.attributes[name];},
    getAttribute(name){return this.attributes[name]||null;}
  });
  const header=make('header'),body=make('body'),head=make('head');
  const rows=[],games=[],news=[];
  const content={querySelectorAll(selector){
    if(selector==='.stats-tablewrap tbody tr')return rows;
    if(selector==='.game,.dash-game,.analyst-list-card')return games;
    if(selector==='.banger-news-card')return news;
    return [];
  }};
  const document={
    readyState:'loading',body,head,
    createElement:make,
    querySelector(selector){return selector==='header.top'?header:null;},
    getElementById(id){if(id==='content')return content; if(id==='fanTeamIdentity')return header.children.find(x=>x.id==='fanTeamIdentity')||null;return null;},
    addEventListener(name,fn){listeners.set(name,fn);},
    dispatchEvent(event){if(listeners.has(event.type))listeners.get(event.type)(event);},
  };
  // Support multiple listeners for the favorite-team-change event.
  const subscriptions=[];
  document.addEventListener=(name,fn)=>subscriptions.push([name,fn]);
  document.dispatchEvent=event=>subscriptions.filter(([name])=>name===event.type).forEach(([,fn])=>fn(event));
  const localStorage={
    getItem:key=>storage.get(key)||null,
    setItem:(key,value)=>storage.set(key,value),
    removeItem:key=>storage.delete(key)
  };
  const ctx={document,localStorage,window:{},MutationObserver:class{observe(){}},
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}}};
  vm.runInNewContext(source,ctx,{filename:'favorite-team.js'});
  document.dispatchEvent({type:'DOMContentLoaded'});
  const picker=header.children.find(x=>x.className==='fan-team-picker');
  const select=picker.children.find(x=>x.tagName==='select');
  return {ctx,document,storage,select,picker,rows,games,news,make};
}
const f=fixture();
assert.equal(f.ctx.window.BangerFavoriteTeam.teams.length,32,'32 NHL clubs');
assert.equal(new Set(f.ctx.window.BangerFavoriteTeam.teams.map(t=>t.code)).size,32,'unique codes');
assert.equal(f.ctx.window.BangerFavoriteTeam.get(),'','no implicit favorite');
assert.equal(f.select.children.length,33,'none option + 32 clubs');
assert.equal(f.document.body.dataset.fanTeam,undefined);
f.select.value='DAL';f.select.onchange();
assert.equal(f.ctx.window.BangerFavoriteTeam.get(),'DAL');
assert.equal(f.storage.get('banger-favorite-team-v1'),'DAL');
assert.equal(f.document.body.dataset.fanTeam,'DAL');
const row=f.make('tr');row.cells=[{textContent:'1'},{textContent:'Player'},{textContent:'DAL'}];
f.rows.push(row);
const game=f.make('article'),teams=f.make('strong');teams.textContent='DAL vs NYR';
game.querySelectorAll=()=>[teams];f.games.push(game);
const dash=f.make('button'),left=f.make('b'),right=f.make('b');
left.textContent='DAL';right.textContent='NYR';
dash.querySelectorAll=()=>[left,right];f.games.push(dash);
const article=f.make('article'),crest=f.make('img');crest.setAttribute('alt','DAL');
article.querySelectorAll=()=>[crest];f.news.push(article);
f.document.dispatchEvent({type:'banger:favorite-team-change'});
assert.ok(row.classList.contains('fan-favorite-row'),'stats highlight');
assert.ok(game.classList.contains('fan-favorite-card'),'game highlight');
assert.ok(dash.classList.contains('fan-favorite-card'),'dashboard game highlight');
assert.ok(article.classList.contains('fan-favorite-card'),'news highlight');
f.select.value='';f.select.onchange();
assert.equal(f.storage.has('banger-favorite-team-v1'),false,'remove preference');
assert.equal(f.document.body.dataset.fanTeam,undefined);
assert.ok(!row.classList.contains('fan-favorite-row'),'remove stats highlight');
assert.ok(!game.classList.contains('fan-favorite-card'),'remove game highlight');
assert.ok(!dash.classList.contains('fan-favorite-card'),'remove dashboard game highlight');
assert.ok(!article.classList.contains('fan-favorite-card'),'remove news highlight');
assert.equal(fixture('NYR').ctx.window.BangerFavoriteTeam.get(),'NYR','restore saved preference');
assert.equal(fixture('INVALID').ctx.window.BangerFavoriteTeam.get(),'','reject invalid saved preference');
console.log('FAN-06 offline preference and highlighting checks passed');

// FAN-17: verify advanced statistics use the actual data team code, not only table column 3.
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const advStart=html.indexOf('function renderAdvanced(){');
const advEnd=html.indexOf('const bangerNavigationTabs=',advStart);
assert(advStart>0&&advEnd>advStart,'advanced renderer exists');
const advanced=html.slice(advStart,advEnd);
assert(advanced.includes('x.teamAbbrevs'),'advanced player/team code sourced from NHL row');
assert(advanced.includes("codes.includes(fanCode)"),'favorite club exact code matching');
assert(advanced.includes("adv-podium-card'+fanClass(x)"),'favorite podium highlight');
assert(advanced.includes("adv-rank-row'+fanClass(x)"),'favorite top ten highlight');
assert(advanced.includes("fanMatch(x)?'fan-favorite-advanced-row'"),'favorite full table highlight');
assert(source.includes('--fan-control-bg'),'secondary color control palette');
assert(source.includes('.adv-rank-row.fan-favorite-advanced-row'),'advanced ranking visual style');
console.log('FAN-17 advanced player identity and dual-tone regression checks passed');

// FAN-18: sticky player-name cells must share the favorite club background.
assert(source.includes('.adv-table tbody tr.fan-favorite-advanced-row > td:first-child'),'advanced sticky player name highlighted');
assert(source.includes('.adv-table tbody tr.fan-favorite-advanced-row > td,'),'all advanced row cells highlighted');
assert(source.includes('position:sticky;'),'sticky column remains fixed');
assert(source.includes('box-shadow:inset 4px 0 var(--fan-accent)'),'club color leading stripe');
console.log('FAN-18 sticky-name and full-row style checks passed');
