(function () {
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  const isHome = document.body.getAttribute("data-page") === "home" || file === "home.html" || file === "";
  const isSearch = document.body.getAttribute("data-page") === "search" || file === "search.html";
  const isAI = document.body.getAttribute("data-page") === "ai" || file === "ai.html";

  function L(ar, en) {
    return localStorage.getItem("zivv.lang") === "en" ? en : ar;
  }

  // Professional SVG icons
  const ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    reels: '<polygon points="5 3 19 12 5 21 5 3"/>',
    profile: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-6 9-6 9h18s-6-2-6-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M18.36 18.36l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M18.36 5.64l2.83-2.83"/>',
    store: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    friends: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    ai: '<path d="M12 2a10 10 0 0 0-9.95 9h11.64L9.74 7.05a10 10 0 0 0 2.26-5.05z"/><path d="M12 2a10 10 0 0 1 9.95 9h-11.64L14.26 7.05A10 10 0 0 0 12 2z"/><path d="M2.05 11a10 10 0 0 0 9.95 9v-5.64L8.05 10.41A10 10 0 0 0 2.05 11z"/><path d="M21.95 11a10 10 0 0 1-9.95 9v-5.64l3.95-3.95A10 10 0 0 1 21.95 11z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    stories: '<circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>'
  };

  function svg(iconName, extra = '') {
    const path = ICONS[iconName] || ICONS.home;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;
  }

  const PAGES = [
    { href: "publish.html", label: L("نشر منشور", "New post"), icon: "plus", primary: true },
    { href: "home.html", label: L("الرئيسية", "Home"), icon: "home" },
    { href: "explore.html", label: L("استكشاف", "Explore"), icon: "search" },
    { href: "reels.html", label: L("الريلز", "Reels"), icon: "reels" },
    { href: "chat.html", label: L("الرسائل", "Messages"), icon: "chat" },
    { href: "alerts.html", label: L("الإشعارات", "Notifications"), icon: "bell" },
    { href: "profile.html", label: L("حسابي", "Profile"), icon: "profile" },
    { href: "settings.html", label: L("الإعدادات", "Settings"), icon: "settings" },
    { href: "store.html", label: L("المتجر", "Store"), icon: "store" },
    { href: "ai.html", label: L("ذكاء ZIVV", "Zivvy AI"), icon: "ai" },
    { href: "music.html", label: L("الموسيقى", "Music"), icon: "music" },
    { href: "friends.html", label: L("الأصدقاء", "Friends"), icon: "friends" },
    { href: "creators.html", label: L("المبدعون", "Creators"), icon: "star" },
    { href: "stories.html", label: L("القصص", "Stories"), icon: "stories" },
  ];

  // For header, show all except current
  const menu = PAGES.filter(p => !p.primary).map((p) =>
    file === p.href ? { href: "home.html", label: L("الرئيسية", "Home"), icon: "home" } : p
  );

  function prefs() {
    try {
      return Object.assign(
        { hideAI: false, mix70: true, hideVideos: false, photosOnly: false },
        JSON.parse(localStorage.getItem("zivv.prefs") || "{}")
      );
    } catch {
      return { hideAI: false, mix70: true, hideVideos: false, photosOnly: false };
    }
  }

  function save(next) {
    localStorage.setItem("zivv.prefs", JSON.stringify(next));
    paintActive();
    window.dispatchEvent(new CustomEvent("zivv-prefs", { detail: next }));
  }

  function isVideo(p) { return p.type === "video" || p.video === true; }
  function isPhoto(p) { return p.type === "photo" || (!!p.image && !isVideo(p)); }
  function isFollowed(p) {
    if (!p) return false;
    try {
      const me = window.ZIVV_CORE && ZIVV_CORE.author ? String(ZIVV_CORE.author().user || "").toLowerCase() : "";
      if (p.user && String(p.user).toLowerCase() === me) return true;
      if (window.ZIVV_CORE && ZIVV_CORE.isFollowing && p.user && ZIVV_CORE.isFollowing(p.user)) return true;
      const fl = JSON.parse(localStorage.getItem("zivv.followUsers") || "[]").map((u) => String(u).toLowerCase());
      if (p.user && fl.includes(String(p.user).toLowerCase())) return true;
      if (window.ZIVV_CREATOR && ZIVV_CREATOR.isGoldUser && ZIVV_CREATOR.isGoldUser(p.user)) return true;
    } catch {}
    return p.following === true;
  }

  function postTags(p) { return (p && p.tags) || []; }
  function matchesUserTags(p, tagSet) {
    return postTags(p).some((t) => tagSet.has(window.ZIVV_CORE ? ZIVV_CORE.norm(t) : String(t).toLowerCase()));
  }

  function classifyPost(p, tagSet, hideAI) {
    if (hideAI || isHome) { if (p.ai === true) return ""; }
    if (isFollowed(p)) return "follow";
    if (tagSet && tagSet.size && matchesUserTags(p, tagSet)) return "tag";
    return "rand";
  }

  function mixAlgo(items, hideAI) {
    const tagSet = window.ZIVV_CORE && window.ZIVV_CORE.userTags ? window.ZIVV_CORE.userTags() : new Set();
    const bags = { follow: [], rand: [], tag: [], ai: [] };
    items.forEach((p) => {
      const k = classifyPost(p, tagSet, hideAI);
      if (k && bags[k]) bags[k].push(p);
    });
    const cycle = ["follow", "follow", "follow", "follow", "follow", "follow", "rand", "rand", "rand", "tag"];
    const idx = { follow: 0, rand: 0, tag: 0, ai: 0 };
    const out = [];
    const used = new Set();
    let stalled = 0;
    while (out.length < items.length && stalled < 8) {
      let added = 0;
      cycle.forEach((k) => {
        while (idx[k] < bags[k].length && used.has(bags[k][idx[k]].id)) idx[k]++;
        if (idx[k] < bags[k].length) {
          const p = bags[k][idx[k]++];
          used.add(p.id);
          out.push(p);
          added++;
        }
      });
      if (!added) stalled++; else stalled = 0;
    }
    ["follow", "rand", "tag", "ai"].forEach((k) => {
      bags[k].forEach((p) => {
        if (!used.has(p.id)) { used.add(p.id); out.push(p); }
      });
    });
    return out;
  }

  function applyFeed(list) {
    const c = prefs();
    const source = Array.isArray(list) ? list.slice() : [];
    let items = source;
    const me = (() => {
      try { return String((window.ZIVV_CORE && window.ZIVV_CORE.author && window.ZIVV_CORE.author().user) || "").toLowerCase(); } catch { return ""; }
    })();
    const mine = (x) => !!(me && x && String(x.user || "").toLowerCase() === me);
    if (c.hideAI || isHome) items = items.filter((x) => x.ai !== true || mine(x));
    if (c.hideVideos) items = items.filter((x) => !isVideo(x) || mine(x));
    if (c.photosOnly) items = items.filter((x) => isPhoto(x) || mine(x));
    if (c.mix70 !== false) items = mixAlgo(items, !!c.hideAI);
    const tagSet = window.ZIVV_CORE && window.ZIVV_CORE.userTags ? window.ZIVV_CORE.userTags() : new Set();
    return {
      items,
      hidden: Math.max(0, source.length - items.length),
      total: source.length,
      shown: items.length,
      follow: items.filter(isFollowed).length,
      other: items.filter((x) => !isFollowed(x)).length,
      tag: items.filter((p) => !isFollowed(p) && matchesUserTags(p, tagSet)).length,
      aiShown: items.filter((p) => p.ai === true).length,
    };
  }

  const homeFilters = isHome
    ? `
      <label class="opt">
        <input type="checkbox" id="pref-hide-videos" />
        <span>${L("إخفاء الفيديوهات", "Hide videos")}</span>
      </label>
      <label class="opt">
        <input type="checkbox" id="pref-photos-only" />
        <span>${L("الصور فقط", "Photos only")}</span>
      </label>`
    : "";

  const searchHome = isSearch
    ? `<a class="opt home-mark" href="home.html"><span class="price">${svg('home')}</span><span>${L("العودة للرئيسية", "Back to Home")}</span></a>`
    : "";

  // Don't inject header if already professional layout (home.html new)
  const hasProLayout = document.querySelector('.app-layout') || document.querySelector('.top-header') || file === 'home.html' || file === 'index.html' || file === 'publish.html';
  
  if (!hasProLayout) {
    const sideIcon = isAI ? svg('menu') : svg('menu');
    const sidePanel = isAI
      ? `<div class="panel filters" id="panel-filters">
          <h3>${L("سجل المحادثات", "Chat history")}</h3>
          <div id="ai-history-list"></div>
        </div>`
      : `<div class="panel filters" id="panel-filters">
          <h3>${L("خيارات الفيد", "Feed options")}</h3>
          <label class="opt">
            <input type="checkbox" id="pref-hide-ai" />
            <span>${L("تقليل منشورات AI", "Hide AI posts")}</span>
          </label>
          <label class="opt">
            <input type="checkbox" id="pref-mix" />
            <span>${L("خوارزمية ZIVV الذكية", "Smart ZIVV algorithm")}</span>
          </label>
          ${homeFilters}
          ${searchHome}
        </div>`;

    const header = document.createElement("header");
    header.className = "top";
    header.innerHTML = `
      <div class="top-start">
        <button class="ico" id="btn-filters" type="button" title="${isAI ? "السجل" : "الفيد"}">${sideIcon}</button>
        <a class="brand" href="home.html">
          <img src="brand/logo-sm.png" alt="" />
          ZIVV
        </a>
      </div>
      <div class="top-actions">
        <a class="ico" href="search.html" title="بحث">${svg('search')}</a>
        <button class="ico" id="btn-apps" type="button" title="القائمة">${svg('grid')}</button>
      </div>
      ${sidePanel}
      <div class="panel apps" id="panel-apps">
        <h3>${L("القائمة", "Menu")}</h3>
        <div class="grid">
          ${menu.map((p) => `<a class="tile" href="${p.href}" data-href="${p.href}"><i>${svg(p.icon)}</i>${p.label}</a>`).join("")}
        </div>
      </div>
    `;

    const scrim = document.createElement("div");
    scrim.className = "scrim";
    document.body.prepend(scrim);
    document.body.prepend(header);

    const cfg = prefs();
    if (!isAI) {
      const hide = document.getElementById("pref-hide-ai");
      const mix = document.getElementById("pref-mix");
      if (hide) hide.checked = !!cfg.hideAI;
      if (mix) mix.checked = cfg.mix70 !== false;
      if (hide) hide.onchange = () => save({ ...prefs(), hideAI: hide.checked });
      if (mix) mix.onchange = () => save({ ...prefs(), mix70: mix.checked });
    }

    if (isHome) {
      const hv = document.getElementById("pref-hide-videos");
      const po = document.getElementById("pref-photos-only");
      if (hv) hv.checked = !!cfg.hideVideos;
      if (po) po.checked = !!cfg.photosOnly;
      if (hv) hv.onchange = () => save({ ...prefs(), hideVideos: hv.checked });
      if (po) po.onchange = () => {
        const next = { ...prefs(), photosOnly: po.checked };
        if (po.checked) next.hideVideos = true;
        if (hv) hv.checked = next.hideVideos;
        save(next);
      };
    }

    function escText(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function paintAiHistory() {
      const box = document.getElementById("ai-history-list");
      if (!box) return;
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem("zivv.aiChats") || "[]");
        if (!Array.isArray(list)) list = [];
      } catch { list = []; }
      if (!list.length) {
        box.innerHTML = '<p class="opt" style="color:#888">لا توجد محادثات بعد</p>';
        return;
      }
      box.innerHTML = list.map((c) => {
        const last = (c.messages || [])[(c.messages || []).length - 1];
        const preview = last ? (last.role === "user" ? "أنت: " : "ZIVV: ") + (last.content || "") : "فارغة";
        return `<div class="hist-row" data-id="${escText(c.id)}">
          <div><b>${escText(c.title || "محادثة")}</b><span>${escText(preview).slice(0, 54)}</span></div>
          <button class="hist-del" type="button" data-del="${escText(c.id)}">✕</button>
        </div>`;
      }).join("");
      box.querySelectorAll(".hist-row").forEach((row) => {
        row.onclick = (e) => {
          if (e.target.closest("[data-del]")) return;
          close();
          const id = row.getAttribute("data-id");
          if (window.ZIVV_AI && ZIVV_AI.open) ZIVV_AI.open(id);
          else location.href = "ai.html?id=" + encodeURIComponent(id);
        };
      });
      box.querySelectorAll("[data-del]").forEach((b) => {
        b.onclick = (e) => {
          e.stopPropagation();
          const id = b.getAttribute("data-del");
          const next = list.filter((c) => c.id !== id);
          localStorage.setItem("zivv.aiChats", JSON.stringify(next));
          paintAiHistory();
          window.dispatchEvent(new CustomEvent("zivv-ai-chats", { detail: { removed: id } }));
        };
      });
    }

    function paintActive() {
      const btn = document.getElementById("btn-filters");
      if (!btn || isAI) return;
      const c = prefs();
      const on = !!(c.hideAI || c.hideVideos || c.photosOnly || c.mix70 !== false);
      btn.classList.toggle("hot", on);
    }
    paintActive();
    if (isAI) paintAiHistory();
    window.addEventListener("zivv-ai-chats", () => { if (isAI) paintAiHistory(); });

    function close() {
      document.getElementById("panel-filters")?.classList.remove("open");
      document.getElementById("panel-apps")?.classList.remove("open");
      scrim.classList.remove("open");
    }
    function open(id) {
      const el = document.getElementById(id);
      const will = !el.classList.contains("open");
      close();
      if (will) { el.classList.add("open"); scrim.classList.add("open"); }
    }

    document.getElementById("btn-filters").onclick = () => { if (isAI) paintAiHistory(); open("panel-filters"); };
    document.getElementById("btn-apps").onclick = () => open("panel-apps");
    scrim.onclick = close;
  }

  // Professional helpers
  window.ZIVV = {
    prefs,
    applyFeed,
    svg,
    ICONS,
    summarize() { return ""; },
  };

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    const s = document.createElement("script");
    s.src = src;
    document.head.appendChild(s);
  }
  if (!window.ZIVV_I18N) {
    const i = document.createElement("script");
    i.src = "js/i18n.js";
    i.onload = () => { if (window.ZIVV_I18N) window.ZIVV_I18N.apply(); };
    document.head.appendChild(i);
  } else { ZIVV_I18N.apply(); }
  loadScript("js/pwa.js?v=26");
  loadScript("js/supabase-config.js");
  loadScript("js/db.js?v=31");
  loadScript("js/ads.js?v=19");
  loadScript("js/creator.js");
  setTimeout(() => loadScript("js/zivvy.js?v=19"), 50);
  setTimeout(() => { if (window.ZIVV_ADS && window.ZIVV_ADS.mount) window.ZIVV_ADS.mount(); }, 90);
})();
