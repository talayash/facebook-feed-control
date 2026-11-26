const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../extension/rules.js');
const fixture = `<main><div role="feed" id="feed">
<article role="article" id="ad"><span>Sponsored</span><p>Product</p></article>
<article role="article" id="suggestion"><span>Suggested for you</span><p>Post</p></article>
<article role="article" id="video"><video></video></article>
<article role="article" id="keyword"><div data-ad-preview="message">Some CELEBRITY gossip today</div></article>
<article role="article" id="ordinary"><div data-ad-preview="message"><span>Sponsored</span> is a word</div><div role="comment">celebrity gossip</div></article>
</div><section id="people"><h2>People you may know</h2><a href="/person">Person</a></section>
<section id="groups"><h2>Suggested groups</h2><a href="/groups/1">Group</a></section></main>
<nav role="navigation"><a id="market" href="/marketplace/">Marketplace</a><a id="home" href="/">Home</a><a id="friends" href="/friends/">Friends</a></nav>`;
function ids(patch, url = 'https://www.facebook.com/') {
  const dom = new JSDOM(fixture, { url });
  const result = [...rules.collectTargets(dom.window.document, { ...rules.DEFAULTS, hideReels: false, hideStories: false, ...patch })].map(node => node.id);
  dom.window.close();
  return result;
}
test('every additional filter defaults off and old settings migrate', () => {
  const migrated = rules.settings({ hideReels: false, hideStories: true });
  for (const [key] of rules.EXTRA_FILTERS) assert.equal(migrated[key], false);
  assert.equal(migrated.paused, false);
  assert.equal(migrated.keywords, '');
  assert.deepEqual(ids({}), []);
});
test('each new filter independently hides its intended fixture', () => {
  for (const [key, expected] of [['hideSponsored','ad'], ['hideSuggested','suggestion'], ['hidePeople','people'], ['hideRecommendations','groups'], ['hideVideos','video'], ['hideSidebar','market'], ['hideFeed','feed']]) {
    assert.deepEqual(ids({ [key]: true }), [expected], key);
  }
});
test('keywords are case-insensitive literal phrases; ignore comments and empty lines', () => {
  assert.deepEqual(ids({ hideKeywords: true, keywords: '\ncelebrity gossip\n' }), ['keyword']);
  assert.deepEqual(ids({ hideKeywords: true, keywords: '.*' }), []);
  assert.deepEqual(ids({ hideKeywords: false, keywords: 'celebrity gossip' }), []);
});
test('home-feed hiding preserves group feeds and pause suppresses all filters', () => {
  assert.deepEqual(ids({ hideFeed: true }, 'https://www.facebook.com/groups/123/'), []);
  assert.deepEqual(ids({ ...Object.fromEntries(rules.FILTER_KEYS.map(key => [key, true])), paused: true }), []);
});
test('presets are explicit and leave keyword/video filters off', () => {
  const distractions = rules.preset('distractions', { keywords: 'saved word' });
  assert.equal(distractions.hideSponsored, true);
  assert.equal(distractions.hideFeed, false);
  assert.equal(distractions.hideVideos, false);
  assert.equal(distractions.hideKeywords, false);
  assert.equal(distractions.keywords, 'saved word');
  assert.equal(rules.preset('minimal').hideFeed, true);
});
test('popup renders new filters after Stories and saves keywords, pause, presets, defaults', async t => {
  const folder = path.join(__dirname, '../extension');
  const read = file => fs.readFileSync(path.join(folder, file), 'utf8');
  const dom = new JSDOM(read('popup.html'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  let stored = { ...rules.DEFAULTS };
  dom.window.chrome = { storage: { local: { get: async () => stored, set: async patch => { stored = { ...stored, ...patch }; } } } };
  dom.window.eval(read('rules.js')); dom.window.eval(read('popup.js'));
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  await tick();
  const doc = dom.window.document;
  const switches = [...doc.querySelectorAll('input[role="switch"]')];
  assert.deepEqual(switches.slice(0, 3).map(node => node.id), ['hideReels','hideStories','hideSponsored']);
  assert.ok(switches.slice(2).every(node => !node.checked));
  const keywordSwitch = doc.getElementById('hideKeywords');
  keywordSwitch.click(); await tick();
  assert.equal(doc.getElementById('keywordEditor').hidden, false);
  doc.getElementById('keywords').value = 'example phrase';
  doc.getElementById('saveKeywords').click(); await tick();
  assert.equal(stored.keywords, 'example phrase');
  doc.getElementById('paused').click(); await tick();
  assert.equal(stored.paused, true);
  doc.getElementById('preset').value = 'minimal';
  doc.getElementById('applyPreset').click(); await tick();
  assert.equal(stored.hideFeed, true);
  assert.equal(stored.paused, false);
  doc.getElementById('restoreDefaults').click(); await tick();
  assert.deepEqual(stored, { ...rules.DEFAULTS });
});
