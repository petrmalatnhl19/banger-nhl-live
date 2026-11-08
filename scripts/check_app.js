// Static syntax and wiring checks for the multi-script GitHub Pages application.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
assert(tags.length > 0, 'No script tags found');
let inlineCount = 0;
let externalCount = 0;
for (const [tag, attributes, source] of tags) {
  const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (src) {
    const relative = src[1].split(/[?#]/)[0];
    assert(!/^https?:\/\//i.test(relative), 'Unexpected remote script: ' + relative);
    const file = path.resolve(relative);
    assert(fs.existsSync(file), 'Missing script file: ' + relative);
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: relative });
    externalCount++;
  } else if (source.trim()) {
    new vm.Script(source, { filename: 'index.html:inline-' + (++inlineCount) });
  }
}
assert(inlineCount > 0, 'Expected app inline scripts');
const required = ['loadGameTimeline(', 'loadBoxscore(', 'startCzechCommentary(', 'loadLineupProjection(', 'bangerGameTimeline', 'data-match-tab="timeline"'];
for (const term of required) assert(html.includes(term), 'Missing app feature: ' + term);
assert(/<\/html\s*>/i.test(html), 'Missing closing HTML tag');
console.log('PASS: ' + inlineCount + ' inline and ' + externalCount + ' local external scripts parse; essential NHL app features present.');
