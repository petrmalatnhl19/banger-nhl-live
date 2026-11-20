const test=require('node:test');
const assert=require('node:assert/strict');
const {render}=require('../video/live-highlights-ui.js');
const {safeUrl}=require('../video/live-highlights.js');
globalThis.BangerLiveHighlights={safeUrl};
function element(){return {children:[],replaceChildren(){this.children=[]},appendChild(x){this.children.push(x)},setAttribute(k,v){this[k]=v}}}
const doc={createElement(){return element()}};
test('renders only available official video links with safe target',()=>{
 const container=element();
 const count=render(container,[{eventId:1,status:'link-available',officialUrl:'https://www.nhl.com/video/goal'},{eventId:2,status:'pending'},{eventId:3,status:'link-available',officialUrl:'https://evil.test/watch'}],doc);
 assert.equal(count,1);
 assert.equal(container.children[0].target,'_blank');
 assert.equal(container.children[0].rel,'noopener noreferrer');
 assert.equal(container.children[0].href,'https://www.nhl.com/video/goal');
});
test('empty state and invalid inputs are safe',()=>{
 const container=element();
 assert.equal(render(container,[],doc),0);
 assert.equal(render(null,[],doc),0);
 assert.equal(container.children.length,0);
});
