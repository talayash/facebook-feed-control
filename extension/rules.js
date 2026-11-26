/* Shared DOM detection. No Facebook class names or page scripts required. */
(function (root) {
  "use strict";
  const EXTRA_FILTERS = [
    ["hideSponsored", "Sponsored posts", "Hide recognized ads in your feed."],
    ["hideSuggested", "Suggested posts", "Skip suggested-for-you posts."],
    ["hidePeople", "People you may know", "Hide friend suggestion panels."],
    ["hideRecommendations", "Suggested groups & pages", "Hide follow and join recommendations."],
    ["hideVideos", "Video posts", "Hide posts with videos or video previews."],
    ["hideKeywords", "Keyword filters", "Hide posts matching your words or phrases."],
    ["hideSidebar", "Sidebar distractions", "Hide gaming, Marketplace and video shortcuts."],
    ["hideFeed", "Entire home feed", "Keep navigation; hide the home news feed."]
  ];
  const DEFAULTS = Object.freeze({ hideReels: true, hideStories: true,
    ...Object.fromEntries(EXTRA_FILTERS.map(([key]) => [key, false])), keywords: "", paused: false });
  const FILTER_KEYS = Object.keys(DEFAULTS).filter(key => key.startsWith("hide"));
  const LABELS = {
    reels: new Set(["reels", "facebook reels", "רילס", "ريلز"]),
    stories: new Set(["stories", "your stories", "סטוריז", "סיפורים", "القصص"])
  };
  function settings(value = {}) {
    return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) =>
      [key, key === "keywords" ? (typeof value[key] === "string" ? value[key].slice(0, 2000) : "")
        : typeof value[key] === "boolean" ? value[key] : fallback]));
  }
  function labelKind(text) {
    const normalized = (text || "").trim().toLowerCase().replace(/\s+/g, " ");
    return Object.keys(LABELS).find(kind => LABELS[kind].has(normalized)) || null;
  }
  function linkKind(href, base = "https://www.facebook.com/") {
    try {
      const url = new URL(href, base);
      if (url.protocol !== "https:" || !/(^|\.)facebook\.com$/.test(url.hostname)) return null;
      if (/^\/reels?(?:\/|$)/i.test(url.pathname)) return "reels";
      if (/^\/stories(?:\/|$)/i.test(url.pathname) || /^\/story\.php$/i.test(url.pathname)) {
        // story.php is Facebook's ordinary post permalink, not an ephemeral Story.
        return /^\/story\.php$/i.test(url.pathname) ? null : "stories";
      }
    } catch { /* Malformed links are ordinary content. */ }
    return null;
  }
  function pageletKind(value) {
    if (/^Reels(?:\b|_|Feed|Unit|Tray)/i.test(value || "")) return "reels";
    if (/^(?:Stories(?:\b|_|Tray|Unit)|StoryTray)/i.test(value || "")) return "stories";
    return null;
  }
  const isBoundary = element => element.matches("html, body, main, [role='main'], [role='feed'], [role='navigation']");
  function safeContainer(element) {
    return !isBoundary(element) && !element.querySelector("main, [role='main'], [role='feed']") &&
      element.querySelectorAll("[role='article']").length <= 1;
  }
  function collectTargets(document, preferences) {
    const targets = new Set();
    if (preferences.paused) return targets;
    const enabled = kind => kind && preferences[kind === "reels" ? "hideReels" : "hideStories"];
    for (const element of document.querySelectorAll("[data-pagelet], [role='region'][aria-label]")) {
      const kind = pageletKind(element.getAttribute("data-pagelet")) ||
        (element.getAttribute("role") === "region" && labelKind(element.getAttribute("aria-label")));
      if (enabled(kind) && safeContainer(element)) targets.add(element);
    }
    // Hide compact shelves that have a feature heading and matching content links.
    for (const heading of document.querySelectorAll("h1, h2, h3, h4, [role='heading']")) {
      const kind = labelKind(heading.textContent);
      if (!enabled(kind)) continue;
      let parent = heading.parentElement;
      for (let depth = 0; parent && depth < 5; depth++, parent = parent.parentElement) {
        if (!safeContainer(parent)) break;
        const links = [...parent.querySelectorAll("a[href]")];
        const matching = links.filter(link => linkKind(link.getAttribute("href"), document.URL) === kind);
        // A heading's own navigation link is not evidence that its parent is a shelf.
        if (matching.some(link => !heading.contains(link)) && parent.textContent.length < 4000 &&
            links.every(link => !linkKind(link.getAttribute("href"), document.URL) ||
              linkKind(link.getAttribute("href"), document.URL) === kind)) {
          targets.add(parent);
          break;
        }
      }
    }
    for (const link of document.querySelectorAll("a[href]")) {
      const kind = linkKind(link.getAttribute("href"), document.URL);
      if (!enabled(kind)) continue;
      let target = link;
      // A plain text mention/link should not remove the surrounding ordinary post.
      const article = link.closest("[role='article']");
      if (kind === "reels" && article && safeContainer(article) &&
          (link.querySelector("video, img") || article.querySelector("video") ||
            labelKind(link.getAttribute("aria-label")) === "reels")) {
        target = article;
      } else if (!article) {
        const item = link.closest("[role='listitem']");
        if (item && safeContainer(item) && [...item.querySelectorAll("a[href]")].every(other =>
          linkKind(other.getAttribute("href"), document.URL) === kind)) target = item;
      }
      targets.add(target);
    }
    collectExtras(document, preferences, targets);
    return targets;
  }
  const EXTRA_LABELS = {
    hideSponsored: ["sponsored", "ממומן", "ممول"],
    hideSuggested: ["suggested for you", "מומלץ עבורך", "مقترح لك"],
    hidePeople: ["people you may know", "אנשים שאולי אתה מכיר", "أشخاص قد تعرفهم"],
    hideRecommendations: ["suggested groups", "suggested pages", "groups you may like", "pages you may like", "קבוצות מומלצות", "דפים מומלצים"]
  };
  const normalize = text => (text || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  function collectExtras(document, preferences, targets) {
    if (!EXTRA_FILTERS.some(([key]) => preferences[key])) return;
    const postSelector = '[role="article"], [data-pagelet^="FeedUnit"]';
    const home = /^\/(?:home\.php)?$/.test(new URL(document.URL).pathname);
    if (preferences.hideFeed && home) {
      for (const feed of document.querySelectorAll('[role="feed"], [data-pagelet="Feed"], [data-pagelet^="FeedUnit"]')) {
        if (!feed.closest('[role="navigation"], [role="dialog"]')) targets.add(feed);
      }
    }
    if (preferences.hideSidebar) {
      for (const link of document.querySelectorAll('[role="navigation"] a[href], nav a[href], [data-pagelet="LeftRail"] a[href]')) {
        try {
          const url = new URL(link.getAttribute('href'), document.URL);
          if (/(^|\.)facebook\.com$/.test(url.hostname) && /^\/(marketplace|gaming|games|watch|reels|video|videos)(\/|$)/.test(url.pathname)) targets.add(link);
        } catch { /* Ignore malformed links. */ }
      }
    }
    // Match labels, not arbitrary substrings inside people's messages or comments.
    for (const label of document.querySelectorAll('h2, h3, [role="heading"], a[aria-label], span')) {
      if (label.closest('[data-ad-preview="message"], [data-ad-comet-preview="message"], [data-testid="post_message"], [role="comment"], [contenteditable="true"]')) continue;
      const text = normalize(label.getAttribute('aria-label') || label.textContent);
      const key = Object.keys(EXTRA_LABELS).find(key => preferences[key] && EXTRA_LABELS[key].includes(text));
      if (!key) continue;
      const post = label.closest(postSelector);
      if (post && safeContainer(post)) { targets.add(post); continue; }
      if (key === 'hideSponsored' || key === 'hideSuggested') continue;
      const panel = label.closest('section, [role="region"], [data-pagelet]');
      if (panel && safeContainer(panel)) targets.add(panel);
    }
    const keywords = preferences.hideKeywords ? [...new Set((preferences.keywords || '').split(/\r?\n/).map(normalize).filter(Boolean))] : [];
    for (const post of document.querySelectorAll(postSelector)) {
      if (!safeContainer(post) || post.closest('[role="dialog"]')) continue;
      if (preferences.hideVideos && (post.querySelector('video') || [...post.querySelectorAll('a[href]')].some(link => {
        try {
          const url = new URL(link.getAttribute('href'), document.URL);
          return /(^|\.)facebook\.com$/.test(url.hostname) && /^\/(reels?|videos?|watch)(\/|$)/.test(url.pathname) && link.querySelector('img, [role="img"]');
        } catch { return false; }
      }))) targets.add(post);
      if (keywords.length) {
        const messages = post.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"], [data-testid="post_message"]');
        // Remove controls and comments from the fallback text before matching.
        const clone = post.cloneNode(true);
        clone.querySelectorAll('[role="comment"], [role="article"], [contenteditable], button, [role="button"], input, textarea').forEach(node => node.remove());
        const text = normalize(messages.length ? [...messages].map(node => node.textContent).join(' ') : clone.textContent);
        if (keywords.some(word => text.includes(word))) targets.add(post);
      }
    }
  }
  function preset(name, current) {
    const next = { ...settings(current), ...Object.fromEntries(FILTER_KEYS.map(key => [key, false])), paused: false };
    if (name === 'distractions' || name === 'minimal') {
      for (const key of ['hideReels', 'hideStories', 'hideSponsored', 'hideSuggested', 'hidePeople', 'hideRecommendations', 'hideSidebar']) next[key] = true;
      next.hideFeed = name === 'minimal';
    }
    return next;
  }
  const api = { DEFAULTS, FILTER_KEYS, EXTRA_FILTERS, preset, settings, labelKind, linkKind, pageletKind, collectTargets };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FeedQuietRules = api;
})(globalThis);
