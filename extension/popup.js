"use strict";
const controls = document.getElementById("controls");
const status = document.getElementById("status");
const rules = globalThis.FeedQuietRules;
let saved = rules.settings();
const extraHeading = document.createElement('h2');
extraHeading.className = 'extra-heading';
extraHeading.textContent = 'More ways to quiet your feed';
controls.append(extraHeading);
for (const [key, title, description] of rules.EXTRA_FILTERS) {
  const label = document.createElement('label');
  label.className = 'setting extra-setting';
  label.htmlFor = key;
  const copy = document.createElement('span');
  copy.className = 'setting-copy';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const detail = document.createElement('span');
  detail.textContent = description;
  copy.append(strong, detail);
  const input = document.createElement('input');
  input.type = 'checkbox'; input.id = key; input.setAttribute('role', 'switch');
  const toggle = document.createElement('span');
  toggle.className = 'switch'; toggle.setAttribute('aria-hidden', 'true');
  label.append(copy, input, toggle);
  controls.append(label);
  if (key === 'hideKeywords') {
    const editor = document.createElement('div');
    editor.id = 'keywordEditor'; editor.hidden = true;
    editor.innerHTML = '<label for="keywords">Words or phrases, one per line</label><textarea id="keywords" maxlength="2000" rows="3" placeholder="Example: celebrity gossip"></textarea><p>Matches text regardless of capitalization, including parts of words. Saved only on this device.</p><button type="button" id="saveKeywords">Save keywords</button>';
    controls.append(editor);
  }
}
const toolsPanel = document.createElement('div');
toolsPanel.className = 'tools-panel';
toolsPanel.innerHTML = '<label class="setting" for="paused"><span class="setting-copy"><strong>Pause filtering</strong><span>Show everything until you switch this off.</span></span><input type="checkbox" role="switch" id="paused"><span class="switch" aria-hidden="true"></span></label><label for="preset">Quick presets</label><div class="preset-row"><select id="preset"><option value="distractions">Hide distractions</option><option value="minimal">Minimal Facebook</option></select><button type="button" id="applyPreset">Apply</button></div><p>Hide distractions enables Reels, Stories, ads, suggestions and sidebar filters. Minimal also hides the home feed.</p><button type="button" id="restoreDefaults">Restore defaults</button>';
controls.append(toolsPanel);
function render() {
  for (const key of [...rules.FILTER_KEYS, 'paused']) document.getElementById(key).checked = saved[key];
  document.getElementById('keywords').value = saved.keywords;
  document.getElementById('keywordEditor').hidden = !saved.hideKeywords;
}
function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}
function summary() {
  const count = rules.FILTER_KEYS.filter(key => saved[key]).length;
  document.body.dataset.filterState = count && !saved.paused ? 'on' : 'off';
  showStatus(saved.paused ? 'Filtering paused. Your settings are saved.' : !count ? 'Filtering is off.' : `${count} filters enabled.${saved.hideKeywords && !saved.keywords.trim() ? ' Add keywords to start matching.' : ''}`);
}
async function persist(patch) {
  controls.disabled = true;
  showStatus('Saving…');
  try {
    await chrome.storage.local.set(patch);
    saved = rules.settings({ ...saved, ...patch });
    render(); summary();
  } catch { render(); showStatus('Could not save. Please try again.', true); }
  finally { controls.disabled = false; }
}
chrome.storage.local.get(rules.DEFAULTS).then(value => {
  saved = rules.settings(value); render(); controls.disabled = false; summary();
}).catch(() => showStatus('Could not load preferences. Reopen this popup to retry.', true));
controls.addEventListener('change', event => {
  const key = event.target.id;
  if (![...rules.FILTER_KEYS, 'paused'].includes(key)) return;
  // Include draft keywords so changing another switch never discards edits.
  const patch = { [key]: event.target.checked };
  const draft = document.getElementById('keywords').value;
  if (draft !== saved.keywords) patch.keywords = draft;
  persist(patch);
});
document.getElementById('saveKeywords').addEventListener('click', () => persist({ keywords: document.getElementById('keywords').value }));
document.getElementById('applyPreset').addEventListener('click', () => persist(rules.preset(document.getElementById('preset').value, { ...saved, keywords: document.getElementById('keywords').value })));
document.getElementById('restoreDefaults').addEventListener('click', () => persist({ ...rules.DEFAULTS }));
