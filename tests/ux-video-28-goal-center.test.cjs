const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const nav = html.split('<nav class="match-tabs"')[1]?.split('</nav>')[0] || '';

test('Goals are a primary match tab, not hidden in More', () => {
  assert.ok(nav, 'match navigation exists');
  assert.ok(nav.includes('data-match-tab="goals"'));
  const more = nav.split('id="matchMoreMenu"')[1]?.split('</div>')[0] || '';
  assert.ok(more, 'More menu exists');
  assert.ok(!more.includes('data-match-tab="goals"'), 'Goals must not be hidden in More');
});

test('Goal Center appears before tabs and opens goals', () => {
  const hero = html.indexOf('class="ux-goal-center"');
  const tabs = html.indexOf('<nav class="match-tabs"', hero);
  assert.ok(hero >= 0 && tabs > hero);
  assert.ok(html.includes('id="goalCenterOpenGoals"'));
  assert.ok(html.includes('id="goalCenterRecaps"'));
  assert.ok(html.includes('goalCenterButton.onclick'));
});

test('score fallback refreshes the Goal Center links safely', () => {
  assert.ok(html.includes('heroRecaps.replaceChildren()'));
  assert.ok(html.includes('heroRecaps.appendChild(a)'));
  assert.ok(html.includes("a.rel='noopener noreferrer'"));
});
