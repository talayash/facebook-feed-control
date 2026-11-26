// Render the real popup with a local storage stub, excluding scripts from the preview.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'extension', name), 'utf8');
async function preview() {
  const dom = new JSDOM(read('popup.html'), { runScripts: 'outside-only' });
  dom.window.chrome = { storage: { local: { get: async defaults => defaults, set: async () => {} } } };
  dom.window.eval(read('rules.js')); dom.window.eval(read('popup.js'));
  await new Promise(resolve => setTimeout(resolve, 0));
  const doc = dom.window.document;
  doc.querySelectorAll('script').forEach(node => node.remove());
  doc.querySelectorAll('input').forEach(node => { if (node.checked) node.setAttribute('checked', ''); });
  doc.querySelector('link').setAttribute('href', '../extension/popup.css');
  doc.querySelector('img').setAttribute('src', '../extension/icons/icon-48.png');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/preview.html'), dom.serialize());
  dom.window.close();
}
preview().catch(error => { console.error(error); process.exitCode = 1; });
