'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
test('DATA-06: lineup projections require valid non-future publication timestamp',()=>{
 assert.ok(html.includes('live.publishedAt&&Number.isFinite(Date.parse(live.publishedAt))'));
 assert.ok(html.includes('Date.now()-Date.parse(live.publishedAt)>=0'));
 assert.ok(html.includes('Date.now()-Date.parse(live.publishedAt)<36*3600000'));
});
test('DATA-06: goalie projections require valid non-future export timestamp',()=>{
 assert.ok(html.includes('Number.isFinite(Date.parse(gd.updatedAt))'));
 assert.ok(html.includes('Date.now()-Date.parse(gd.updatedAt)>=0'));
 assert.ok(html.includes('Date.now()-Date.parse(gd.updatedAt)<24*3600000'));
});

test('DATA-06: stale goalie status is clearly labelled as unverified',()=>{
 assert.ok(html.includes('Neaktuální údaj o brankáři – start neověřen'));
});
