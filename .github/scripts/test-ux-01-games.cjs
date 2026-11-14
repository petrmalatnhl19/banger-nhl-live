'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('styles/ux-01-compact-games.css','utf8');
const start = html.indexOf("let uxSelectedGameFilter='all';");
const end = html.indexOf("function uxRenderDays()",start);
assert(start>=0 && end>start,'Game filter handler missing');
const code=html.slice(start,end);
class FakeClassList {
 constructor(){this.set=new Set()}
 toggle(name,enabled){if(enabled===undefined)enabled=!this.set.has(name);enabled?this.set.add(name):this.set.delete(name)}
 contains(name){return this.set.has(name)}
}
const buttons=['all','live','upcoming','final'].map(gameFilter=>({dataset:{gameFilter},classList:new FakeClassList(),setAttribute(k,v){this[k]=v},addEventListener(k,fn){this.click=fn}}));
const bar={querySelectorAll:()=>buttons};
const cards=['upcoming','upcoming','final','live'].map(gamePhase=>({dataset:{gamePhase},classList:new FakeClassList()}));
const empty={classList:new FakeClassList(),textContent:''};
const content={appendChild(){},querySelector:()=>cards[0]};
const $=id=>id==='uxGamesFilter'?bar:id==='uxGameFilterEmpty'?empty:content;
const document={querySelectorAll:selector=>selector.startsWith('#uxGamesFilter')?buttons:cards,querySelector:()=>cards[0],createElement:()=>empty};
const ctx=vm.createContext({$,document});
vm.runInContext(code,ctx);
const expected={all:4,live:1,upcoming:2,final:1};
for(const button of buttons){
 button.click();
 assert.equal(cards.filter(c=>!c.classList.contains('hidden')).length,expected[button.dataset.gameFilter],button.dataset.gameFilter);
 assert.equal(button['aria-pressed'],'true');
 assert(buttons.filter(b=>b['aria-pressed']==='true').length===1);
}
cards.forEach(c=>c.dataset.gamePhase='upcoming');
buttons.find(b=>b.dataset.gameFilter==='live').click();
assert(cards.every(c=>c.classList.contains('hidden')),'Empty filter must hide all cards');
assert(!empty.classList.contains('hidden'),'Empty state must be visible');
buttons[0].click();
assert(empty.classList.contains('hidden'),'Empty state must clear');
assert(css.includes('#content .grid > .game[data-game-phase].hidden'),'Filtered cards must have a display:none override');
assert(css.includes('#calendarBar .daynav #prevDay')&&css.includes('#calendarBar .daynav #nextDay'),'Both calendar arrows must be restored');
assert(css.includes('padding-bottom: calc(120px'),'Mobile scroll safe space missing');
console.log('UX-01 game filters: all/live/upcoming/final, empty state, arrow and layout guards PASS');
