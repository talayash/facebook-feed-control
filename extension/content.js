(function () {
  "use strict";
  const rules = globalThis.FeedQuietRules;
  const marker = "data-feed-quiet-hidden";
  let preferences = rules.settings();
  let hidden = new Set();
  let timer = null;
  let disposed = false;
  const changedKeys = new Set();

  function pauseMedia(element) {
    const videos = element.matches("video") ? [element] : element.querySelectorAll("video");
    for (const video of videos) if (!video.paused) video.pause();
  }
  function scan() {
    timer = null;
    if (disposed) return;
    const next = rules.collectTargets(document, preferences);
    for (const element of hidden) {
      if (!next.has(element)) element.removeAttribute(marker);
    }
    for (const element of next) {
      if (element.getAttribute(marker) !== "true") element.setAttribute(marker, "true");
      pauseMedia(element);
    }
    hidden = next;
  }
  function schedule() {
    if (!disposed && timer === null) timer = setTimeout(scan, 100);
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["href", "aria-label", "role", "data-pagelet"]
  });
  // Prevent hidden videos from starting again after Facebook's autoplay updates.
  document.addEventListener("play", event => {
    if (event.target instanceof HTMLMediaElement && event.target.closest(`[${marker}="true"]`)) {
      event.target.pause();
    }
  }, true);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of Object.keys(rules.DEFAULTS)) {
      if (changes[key]) {
        changedKeys.add(key);
        preferences[key] = rules.settings({ [key]: changes[key].newValue })[key];
      }
    }
    schedule();
  });
  chrome.storage.local.get(rules.DEFAULTS).then(value => {
    const initial = rules.settings(value);
    for (const key of Object.keys(rules.DEFAULTS)) {
      if (!changedKeys.has(key)) preferences[key] = initial[key];
    }
    schedule();
  }).catch(() => {
    // An extension reload invalidates old content scripts. Restore the page.
    disposed = true;
    observer.disconnect();
    if (timer !== null) clearTimeout(timer);
    for (const element of hidden) element.removeAttribute(marker);
    hidden.clear();
  });
})();
