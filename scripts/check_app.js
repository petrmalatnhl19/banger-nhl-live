// Basic no-dependency static smoke test for the GitHub Pages single-file app.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)];
if (scripts.length !== 1) throw Error('Expected exactly one inline app script, got ' + scripts.length);
const js = scripts[0][1];
new vm.Script(js, { filename: 'index.html:inline-script' });
const required = ['loadGameTimeline(', 'loadBoxscore(', 'startCzechCommentary(', 'loadLineupProjection(', 'bangerGameTimeline', 'data-match-tab="timeline"'];
for (const term of required) if (!html.includes(term)) throw Error('Missing app feature: ' + term);
if (!html.includes('</html>')) throw Error('Missing closing HTML tag');
console.log('OK: JavaScript syntax, HTML structure and essential NHL app features.');
