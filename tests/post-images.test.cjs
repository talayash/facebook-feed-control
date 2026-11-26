const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const rules = require('../extension/rules.js');
function hidden(html) {
  const dom = new JSDOM(html, { url: 'https://www.facebook.com/' });
  const ids = [...rules.collectTargets(dom.window.document, rules.DEFAULTS)].map(element => element.id);
  dom.window.close();
  return ids;
}
test('Story-linked avatars and images survive in all supported post containers', () => {
  for (const wrapper of ['article', 'div role="article"', 'div data-pagelet="FeedUnit_0"', 'div']) {
    const tag = wrapper.split(' ')[0];
    assert.deepEqual(hidden(`<${wrapper} id="post"><a id="avatar" href="/stories/123/"><svg><image href="logo.png" /></svg></a><h3>Page name</h3><p>Ordinary post</p><a id="photo" href="/stories/456/"><img src="photo.jpg"></a></${tag}>`), []);
  }
});
test('Story tray is still hidden while an adjacent post avatar remains', () => {
  const ids = hidden('<main><section id="tray" data-pagelet="Stories"><a href="/stories/1/"><img></a></section><article id="post"><a id="avatar" href="/stories/1/"><img></a>Normal post</article></main>');
  assert.ok(ids.includes('tray'));
  assert.ok(!ids.includes('avatar'));
  assert.ok(!ids.includes('post'));
});
test('ordinary videos with plain Reel links and Reel-linked header images survive', () => {
  assert.deepEqual(hidden('<article id="post"><header><a href="/reel/1"><img></a></header><video></video><p>Discussing <a href="/reel/2">another reel</a></p></article>'), []);
});
test('confirmed Reel media posts and shelves still hide', () => {
  const ids = hidden('<main><article id="reel"><a href="/reel/1"><video></video></a></article><section id="shelf"><h2>Reels</h2><a href="/reel/2"><img></a></section></main>');
  assert.ok(ids.includes('reel'));
  assert.ok(ids.includes('shelf'));
});
