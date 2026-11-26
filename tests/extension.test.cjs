const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const rules = require('../extension/rules.js');
const extension = path.join(__dirname, '../extension');
const read = name => fs.readFileSync(path.join(extension, name), 'utf8');
const tick = (ms = 160) => new Promise(resolve => setTimeout(resolve, ms));

function page(html) {
  return new JSDOM(html, { url: 'https://www.facebook.com/', runScripts: 'outside-only' });
}
function targets(html, settings = rules.DEFAULTS) {
  const dom = page(html);
  const ids = [...rules.collectTargets(dom.window.document, settings)].map(node => node.id);
  dom.window.close();
  return ids;
}
test('manifest uses only storage and Facebook content-script access; all assets exist', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  for (const content of manifest.content_scripts) {
    assert.ok(content.matches.every(match => /^https:\/\/(www\.|m\.)?facebook\.com\/\*$/.test(match)));
    for (const asset of [...content.js, ...content.css]) assert.ok(fs.existsSync(path.join(extension, asset)));
  }
  assert.ok(fs.existsSync(path.join(extension, manifest.action.default_popup)));
});
test('classifies Facebook feature URLs, not ordinary posts or external URLs', () => {
  for (const href of ['/reel/123?foo=bar', '/reels/', 'https://m.facebook.com/reel/5']) assert.equal(rules.linkKind(href), 'reels');
  assert.equal(rules.linkKind('/stories/123/456/'), 'stories');
  for (const href of ['/story.php?story_fbid=123&id=5', '/posts/123', '/reelistic', 'https://facebook.com.evil.test/reel/1', 'https://example.com/stories/', 'javascript:alert(1)']) {
    assert.equal(rules.linkKind(href), null, href);
  }
});
test('normalizes malformed preferences and preserves explicit false', () => {
  assert.deepEqual(rules.settings({ hideReels: false, hideStories: 'false' }), { ...rules.DEFAULTS, hideReels: false });
});
const fixture = `<main><section id="stories" data-pagelet="Stories"><a id="story" href="/stories/1/">A story</a></section>
  <section id="reels"><h2>Reels</h2><div><a id="reel" href="/reel/123"><img alt="Preview"></a></div></section>
  <div role="feed"><article id="normal" role="article"><p>A normal post</p><a href="/story.php?story_fbid=4">Permalink</a></article></div></main>`;
test('independent settings support all four combinations', () => {
  for (const hideReels of [false, true]) for (const hideStories of [false, true]) {
    const result = targets(fixture, { hideReels, hideStories });
    assert.equal(result.includes('reels'), hideReels);
    assert.equal(result.includes('stories'), hideStories);
    assert.ok(!result.includes('normal'));
  }
});
test('never hides main or feed containers', () => {
  assert.deepEqual(targets('<main id="main" data-pagelet="Reels"><div id="feed" role="feed" data-pagelet="Stories"></div></main>'), []);
});
test('hides media reel posts, while preserving ordinary posts with text links', () => {
  const result = targets(`<div role="feed">
    <div role="article" id="video-post"><a href="/reel/1"><video></video></a></div>
    <div role="article" id="image-post"><a href="/reel/2"><img></a></div>
    <div role="article" id="text-post">My opinion about <a id="mention" href="/reel/3">this reel</a></div>
    <div role="article" id="ordinary-video"><video></video><a href="/videos/4">Video</a></div></div>`);
  assert.ok(result.includes('video-post'));
  assert.ok(result.includes('image-post'));
  assert.ok(result.includes('mention'));
  assert.ok(!result.includes('text-post'));
  assert.ok(!result.includes('ordinary-video'));
});
test('localized labels and language-independent URLs work', () => {
  assert.ok(targets('<section id="s" role="region" aria-label="סטוריז"></section>').includes('s'));
  assert.ok(targets('<a id="s" href="/stories/5/">Unrecognized language</a>').includes('s'));
});
test('a shelf heading cannot hide a whole feed of unrelated articles', () => {
  const result = targets('<div id="outer"><h2>Reels</h2><div role="article">Normal</div><div role="article"><a id="link" href="/reel/1">Link</a></div></div>');
  assert.deepEqual(result, ['link']);
});
test('content script filters inserts, restores on toggles, and rechecks recycled nodes', async t => {
  const dom = page(fixture);
  t.after(() => dom.window.close());
  const { window } = dom;
  let change;
  window.chrome = { storage: { local: { get: async () => rules.DEFAULTS }, onChanged: { addListener: callback => { change = callback; } } } };
  window.eval(read('rules.js'));
  window.eval(read('content.js'));
  const style = window.document.createElement('style');
  style.textContent = read('content.css');
  window.document.head.append(style);
  const hidden = id => window.document.getElementById(id).hasAttribute('data-feed-quiet-hidden');
  await tick();
  assert.equal(hidden('stories'), true);
  assert.equal(window.getComputedStyle(window.document.getElementById('stories')).display, 'none');
  assert.equal(window.getComputedStyle(window.document.getElementById('normal')).display, 'block');
  window.document.querySelector('main').insertAdjacentHTML('beforeend', '<a id="new" href="/reel/99">Reel</a>');
  await tick();
  assert.equal(hidden('new'), true);
  window.document.getElementById('new').setAttribute('href', '/posts/99');
  await tick();
  assert.equal(hidden('new'), false);
  change({ hideReels: { newValue: false }, hideStories: { newValue: false } }, 'local');
  await tick();
  assert.equal(window.document.querySelectorAll('[data-feed-quiet-hidden]').length, 0);
  change({ hideStories: { newValue: true } }, 'local');
  await tick();
  assert.equal(hidden('stories'), true);
  assert.equal(hidden('reels'), false);
});
test('a late initial storage read cannot overwrite a newer toggle', async t => {
  const dom = page(fixture);
  t.after(() => dom.window.close());
  let change, resolveRead;
  dom.window.chrome = { storage: { local: { get: () => new Promise(resolve => { resolveRead = resolve; }) }, onChanged: { addListener: cb => { change = cb; } } } };
  dom.window.eval(read('rules.js'));
  dom.window.eval(read('content.js'));
  change({ hideReels: { newValue: false } }, 'local');
  resolveRead({ hideReels: true, hideStories: false });
  await tick();
  assert.equal(dom.window.document.querySelectorAll('[data-feed-quiet-hidden]').length, 0);
});
test('hidden videos are paused on detection and subsequent autoplay', async t => {
  const dom = page('<div data-pagelet="Reels"><video id="hidden"></video></div><video id="normal"></video>');
  t.after(() => dom.window.close());
  const { window } = dom;
  window.chrome = { storage: { local: { get: async () => rules.DEFAULTS }, onChanged: { addListener() {} } } };
  const video = window.document.getElementById('hidden');
  const normal = window.document.getElementById('normal');
  let pauses = 0, normalPauses = 0;
  Object.defineProperty(video, 'paused', { get: () => false });
  video.pause = () => { pauses++; };
  normal.pause = () => { normalPauses++; };
  window.eval(read('rules.js'));
  window.eval(read('content.js'));
  await tick();
  assert.equal(pauses, 1);
  video.dispatchEvent(new window.Event('play'));
  normal.dispatchEvent(new window.Event('play'));
  assert.equal(pauses, 2);
  assert.equal(normalPauses, 0);
});
test('popup saves one switch independently and rolls back on write failure', async t => {
  const dom = page(read('popup.html'));
  t.after(() => dom.window.close());
  const writes = [];
  let fail = false;
  dom.window.chrome = { storage: { local: { get: async () => rules.DEFAULTS, set: async value => { if (fail) throw Error('Storage unavailable'); writes.push(value); } } } };
  dom.window.eval(read('rules.js'));
  dom.window.eval(read('popup.js'));
  await tick(0);
  const control = dom.window.document.getElementById('hideReels');
  assert.equal(control.checked, true);
  control.checked = false;
  control.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(0);
  assert.equal(JSON.stringify(writes), '[{"hideReels":false}]');
  assert.equal(dom.window.document.getElementById('hideStories').checked, true);
  fail = true;
  control.checked = true;
  control.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick(0);
  assert.equal(control.checked, false);
  assert.equal(dom.window.document.getElementById('status').dataset.error, 'true');
  assert.equal(dom.window.document.getElementById('controls').disabled, false);
});
