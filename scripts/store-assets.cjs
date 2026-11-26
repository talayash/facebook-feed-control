const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const out = path.join(root, 'store-assets');
fs.mkdirSync(out, { recursive: true });
const read = name => fs.readFileSync(path.join(root, 'extension', name), 'utf8');
async function popup(name, preferences, scroll = 0) {
  const dom = new JSDOM(read('popup.html'), { runScripts: 'outside-only' });
  dom.window.chrome = { storage: { local: { get: async defaults => ({ ...defaults, ...preferences }), set: async () => {} } } };
  dom.window.eval(read('rules.js')); dom.window.eval(read('popup.js'));
  await new Promise(resolve => setTimeout(resolve, 0));
  const doc = dom.window.document;
  doc.querySelectorAll('script').forEach(node => node.remove());
  doc.querySelectorAll('input').forEach(node => { if (node.checked) node.setAttribute('checked', ''); });
  doc.querySelectorAll('textarea').forEach(node => { node.textContent = node.value; });
  doc.querySelector('link').href = '../extension/popup.css';
  doc.querySelector('img').src = '../extension/icons/icon-48.png';
  const scrollScript = doc.createElement('script');
  scrollScript.textContent = `window.addEventListener('load', () => { document.querySelector('main').scrollTop = ${scroll}; });`;
  doc.body.append(scrollScript);
  fs.writeFileSync(path.join(out, `${name}.html`), dom.serialize());
  dom.window.close();
}
const style = `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:'Segoe UI',sans-serif;background:#f2f5eb;color:#243f36} .brand{display:flex;align-items:center;gap:13px;font-size:25px;font-weight:750;letter-spacing:-1px}.brand img{width:46px;height:46px}.brand b{color:#b58b47}.tag{font-size:12px;letter-spacing:3px;font-weight:700;color:#6e805d;margin-top:52px}h1{font-size:62px;letter-spacing:-3px;line-height:1.08;margin:20px 0 24px;font-weight:720}h1 span{color:#6b8556}.copy{font-size:20px;line-height:1.6;color:#65725d;max-width:460px}.pill{display:inline-block;border:1px solid #cbd7bf;border-radius:30px;padding:9px 16px;font-size:13px;color:#4c6540;margin:20px 7px 0 0}.left{position:absolute;left:85px;top:85px;width:540px}.frame{position:absolute;left:760px;top:97px;width:394px;height:592px;border:1px solid #ccd7c2;border-radius:20px;overflow:hidden;box-shadow:0 28px 60px #294c3b22;background:#fafbf7}iframe{border:0;width:392px;height:590px;display:block}.orb{position:absolute;width:660px;height:660px;background:#e4ebd8;border-radius:50%;left:650px;top:40px}.bottom{position:absolute;bottom:38px;left:85px;font-size:12px;color:#6b785f;letter-spacing:.2px}.index{position:absolute;right:65px;bottom:37px;font-size:12px;color:#6b785f}.small .left{left:28px;top:26px;width:390px}.small .brand{font-size:20px;gap:9px}.small .brand img{width:36px;height:36px}.small h1{font-size:39px;letter-spacing:-1.7px;margin:24px 0 14px}.small .copy{font-size:13px;line-height:1.6;max-width:340px}.small .orb{width:260px;height:260px;left:300px;top:140px}.wide .left{left:85px;top:65px}.wide .tag{margin-top:30px}.wide h1{font-size:61px}.wide .copy{font-size:19px}.wide .orb{left:840px;top:-50px}.cards{position:absolute;left:875px;top:140px;width:390px;transform:rotate(4deg)}.card{display:flex;align-items:center;justify-content:space-between;background:#fafbf7;border:1px solid #c9d5be;border-radius:20px;padding:28px;margin-bottom:15px;box-shadow:0 12px 35px #294c3b12;font-size:23px;font-weight:650}.toggle{width:54px;height:30px;padding:4px;background:#45663c;border-radius:22px}.toggle:after{content:'';display:block;width:22px;height:22px;border-radius:50%;background:white;margin-left:24px}.cards p{font-size:15px;color:#65725d;text-align:center;margin-top:27px}`;
const brand = '<div class="brand"><img src="../extension/icons/icon-128.png" alt="">feed quiet<b>.</b></div>';
function page(file, cls, body, script = '') {
  const height = cls === 'small' ? 280 : cls === 'wide' ? 560 : 800;
  fs.writeFileSync(path.join(out, `${file}.html`), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Feed Quiet</title><style>${style}body{position:relative;height:${height}px}</style><body class="${cls}">${body}${script}</body></html>`);
}
async function main() {
  await popup('popup-default', {});
  await popup('popup-extras', {}, 400);
  await popup('popup-keywords', { hideKeywords: true, keywords: 'celebrity gossip\nmovie spoilers' }, 830);
  const slides = [
    ['01-screenshot', 'A LITTLE LESS NOISE', 'Your feed.<br><span>Your focus.</span>', 'Hide Facebook Reels and Stories with two simple switches. Keep the connections. Skip the distractions.', 'Reels & Stories', 'Your choice', 'popup-default', 0],
    ['02-screenshot', 'MORE CONTROL, LESS CLUTTER', 'Choose what<br><span>stays out.</span>', 'Optional filters for ads, suggested posts, friend suggestions, videos and more. Every extra filter starts off.', 'Independent switches', 'Off by default', 'popup-extras', 400],
    ['03-screenshot', 'MAKE IT PERSONAL', 'Your words.<br><span>Your boundaries.</span>', 'Hide posts that match your words or phrases. Save a list, change it anytime, and keep it on your device.', 'Keyword filters', 'Stored locally', 'popup-keywords', 850]
  ];
  slides.forEach(([name, tag, heading, copy, first, second, source, scroll], index) => page(name, '', `<div class="orb"></div><div class="left">${brand}<div class="tag">${tag}</div><h1>${heading}</h1><p class="copy">${copy}</p><span class="pill">${first}</span><span class="pill">${second}</span></div><div class="frame"><iframe title="Feed Quiet popup" src="${source}.html"></iframe></div><div class="bottom">FOR FACEBOOK ON CHROME · NO TRACKING</div><div class="index">0${index + 1} / 03</div>`, `<script>document.querySelector('iframe').onload = function(){this.contentDocument.querySelector('main').scrollTop=${scroll};};</script>`));
  page('small-promo-440x280', 'small', `<div class="orb"></div><div class="left">${brand}<h1>Less noise.<br><span>Your feed, your way.</span></h1><div class="copy">Hide Reels, Stories and distractions.<br>Simple switches. No tracking.</div></div>`);
  page('marquee-1400x560', 'wide', `<div class="orb"></div><div class="left">${brand}<div class="tag">FOR FACEBOOK ON CHROME</div><h1>Take back<br><span>your feed.</span></h1><p class="copy">Hide Reels, Stories and everyday distractions.<br>One quieter feed. Your choice.</p></div><div class="cards"><div class="card">Hide Reels<span class="toggle"></span></div><div class="card">Hide Stories<span class="toggle"></span></div><p>Simple controls. Saved on your device.</p></div>`);
  fs.copyFileSync(path.join(root, 'extension/icons/icon-128.png'), path.join(out, 'store-icon-128.png'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
