(function () {
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  const isHome =
    document.body.getAttribute("data-page") === "home" ||
    file === "home.html" ||
    file === "";
  const isSearch =
    document.body.getAttribute("data-page") === "search" ||
    file === "search.html";
  const isAI =
    document.body.getAttribute("data-page") === "ai" ||
    file === "ai.html";

  const PAGES = [
    { href: "publish.html", label: "نشر منشور", icon: "+" },
    { href: "creators.html", label: "صناع المحتوى", icon: "★" },
    { href: "explore.html", label: "استكشف", icon: "⌕" },
    { href: "reels.html", label: "الشريط", icon: "▷" },
    { href: "profile.html", label: "الملف الشخصي", icon: "◉" },
    { href: "settings.html", label: "الإعدادات", icon: "⚙" },
    { href: "chat.html", label: "الدردشة", icon: "💬" },
    { href: "private.html", label: "دردشة خاصة", icon: "🔒" },
    { href: "store.html", label: "المتجر الإلكتروني", icon: "🛍" },
    { href: "ai.html", label: "دردشة الذكاء", icon: "✦" },
    { href: "alerts.html", label: "الإشعارات", icon: "🔔" },
    { href: "friends.html", label: "الأصدقاء", icon: "👥" },
    { href: "music.html", label: "الموسيقى", icon: "♪" },
    { href: "stories.html", label: "الحالات", icon: "◉" },
  ];

  const menu = PAGES.map((p) =>
    file === p.href ? { href: "home.html", label: "الرئيسية", icon: "⌂" } : p
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

  function svg(path) {
    return `<svg viewBox="0 0 24 24">${path}</svg>`;
  }

  function isVideo(p) {
    return p.type === "video" || p.video === true;
  }
  function isPhoto(p) {
    return p.type === "photo" || (!!p.image && !isVideo(p));
  }
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

  function postTags(p) {
    return (p && p.tags) || [];
  }

  function matchesUserTags(p, tagSet) {
    return postTags(p).some((t) => tagSet.has(window.ZIVV_CORE ? ZIVV_CORE.norm(t) : String(t).toLowerCase()));
  }

  function classifyPost(p, tagSet, hideAI) {
    if (hideAI || isHome) {
      if (p.ai === true) return "";
    }
    if (isFollowed(p)) return "follow";
    if (tagSet && tagSet.size && matchesUserTags(p, tagSet)) return "tag";
    return "rand";
  }

  function mixAlgo(items, hideAI) {
    const tagSet = window.ZIVV_CORE && ZIVV_CORE.userTags ? ZIVV_CORE.userTags() : new Set();
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
      if (!added) stalled++;
      else stalled = 0;
    }
    ["follow", "rand", "tag", "ai"].forEach((k) => {
      bags[k].forEach((p) => {
        if (!used.has(p.id)) {
          used.add(p.id);
          out.push(p);
        }
      });
    });
    return out;
  }

  function applyFeed(list) {
    const c = prefs();
    const source = Array.isArray(list) ? list.slice() : [];
    let items = source;
    if (c.hideAI || isHome) items = items.filter((x) => x.ai !== true);
    if (c.hideVideos) items = items.filter((x) => !isVideo(x));
    if (c.photosOnly) items = items.filter(isPhoto);
    if (c.mix70 !== false) items = mixAlgo(items, !!c.hideAI);
    const tagSet = window.ZIVV_CORE && ZIVV_CORE.userTags ? ZIVV_CORE.userTags() : new Set();
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
        <span>لا أريد رؤية الفيديوهات</span>
      </label>
      <label class="opt">
        <input type="checkbox" id="pref-photos-only" />
        <span>لا أريد رؤية إلا الصور</span>
      </label>`
    : "";

  const searchHome = isSearch
    ? `<a class="opt home-mark" href="home.html"><span class="price">⌂</span><span>الرجوع للصفحة الرئيسية</span></a>`
    : "";

  const sideIcon = isAI
    ? svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4.2" cy="6" r="1.2"/><circle cx="4.2" cy="12" r="1.2"/><circle cx="4.2" cy="18" r="1.2"/>')
    : svg('<path d="M4 6h16M7 12h10M10 18h4"/>');
  const sidePanel = isAI
    ? `<div class="panel filters" id="panel-filters">
        <h3>سجل المحادثات</h3>
        <div id="ai-history-list"></div>
      </div>`
    : `<div class="panel filters" id="panel-filters">
        <h3>خيارات الفيد</h3>
        <label class="opt">
          <input type="checkbox" id="pref-hide-ai" />
          <span>تقليل منشورات الذكاء الاصطناعي</span>
        </label>
        <label class="opt">
          <input type="checkbox" id="pref-mix" />
          <span>خوارزمية زيفي: ٦٠٪ متابعة · ٢٩٪ عشوائي · ١١٪ هاشتاج</span>
        </label>
        ${homeFilters}
        ${searchHome}
      </div>`;

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div class="top-start">
      <button class="ico" id="btn-filters" type="button" title="${isAI ? "سجل المحادثات" : "خيارات الفيد"}">${sideIcon}</button>
      <a class="brand" href="home.html">
        <img src="brand/logo-sm.png" alt="" />
        ZIVV
      </a>
    </div>
    <div class="top-actions">
      <a class="ico" href="search.html" title="بحث">${svg(
        '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>'
      )}</a>
      <button class="ico" id="btn-apps" type="button" title="الصفحات">${svg(
        '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'
      )}</button>
    </div>
    ${sidePanel}
    <div class="panel apps" id="panel-apps">
      <h3>الصفحات</h3>
      <div class="grid">
        ${menu
          .map((p) => `<a class="tile" href="${p.href}" data-href="${p.href}"><i>${p.icon}</i>${p.label}</a>`)
          .join("")}
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
    hide.checked = !!cfg.hideAI;
    mix.checked = cfg.mix70 !== false;
    hide.onchange = () => save({ ...prefs(), hideAI: hide.checked });
    mix.onchange = () => save({ ...prefs(), mix70: mix.checked });
  }

  if (isHome) {
    const hv = document.getElementById("pref-hide-videos");
    const po = document.getElementById("pref-photos-only");
    hv.checked = !!cfg.hideVideos;
    po.checked = !!cfg.photosOnly;
    hv.onchange = () => save({ ...prefs(), hideVideos: hv.checked });
    po.onchange = () => {
      const next = { ...prefs(), photosOnly: po.checked };
      if (po.checked) next.hideVideos = true;
      if (hv) hv.checked = next.hideVideos;
      save(next);
    };
  }

  function escText(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function paintAiHistory() {
    const box = document.getElementById("ai-history-list");
    if (!box) return;
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem("zivv.aiChats") || "[]");
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
    if (!list.length) {
      box.innerHTML = '<p class="opt" style="color:#888">مفيش محادثات لسه. ابدأ من علامة + جوّه الصفحة.</p>';
      return;
    }
    box.innerHTML = list
      .map((c) => {
        const last = (c.messages || [])[(c.messages || []).length - 1];
        const preview = last
          ? (last.role === "user" ? "أنت: " : "زيفي: ") + (last.content || "")
          : "فاضية";
        return `<div class="hist-row" data-id="${escText(c.id)}">
          <div>
            <b>${escText(c.title || "دردشة")}</b>
            <span>${escText(preview).slice(0, 54)}</span>
          </div>
          <button class="hist-del" type="button" data-del="${escText(c.id)}" title="حذف">✕</button>
        </div>`;
      })
      .join("");
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
  window.addEventListener("zivv-ai-chats", () => {
    if (isAI) paintAiHistory();
  });

  function close() {
    document.getElementById("panel-filters").classList.remove("open");
    document.getElementById("panel-apps").classList.remove("open");
    scrim.classList.remove("open");
  }
  function open(id) {
    const el = document.getElementById(id);
    const will = !el.classList.contains("open");
    close();
    if (will) {
      el.classList.add("open");
      scrim.classList.add("open");
    }
  }

  document.getElementById("btn-filters").onclick = () => {
    if (isAI) paintAiHistory();
    open("panel-filters");
  };
  document.getElementById("btn-apps").onclick = () => open("panel-apps");
  scrim.onclick = close;

  const settingsTile = header.querySelector('a.tile[data-href="settings.html"]');
  if (settingsTile) {
    let hold = null;
    let locked = false;
    function kingPass() {
      try {
        return localStorage.getItem("zivv.kingPass") || "زياد أحمد صبحي";
      } catch {
        return "زياد أحمد صبحي";
      }
    }
    function askKing() {
      let box = document.getElementById("zivv-king-ask");
      if (!box) {
        box = document.createElement("div");
        box.id = "zivv-king-ask";
        box.innerHTML = `
          <div class="zivv-king-sheet">
            <b>صفحة الملك</b>
            <p>اكتب كلمة المرور — ظاهرة وأنت بتكتب.</p>
            <input id="zivv-king-in" type="text" autocomplete="off" />
            <div>
              <button type="button" id="zivv-king-go">دخول</button>
              <button type="button" id="zivv-king-x">إلغاء</button>
            </div>
          </div>`;
        const css = document.createElement("style");
        css.textContent = "#zivv-king-ask{display:none;position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:90;place-items:center}#zivv-king-ask.on{display:grid}.zivv-king-sheet{width:min(340px,92vw);background:#0a0a0a;border:1px solid #333;border-radius:16px;padding:16px}.zivv-king-sheet b{display:block;margin-bottom:6px}.zivv-king-sheet p{color:#888;font-size:13px;margin-bottom:10px}.zivv-king-sheet input{width:100%;background:#111;border:1px solid #333;color:#fff;border-radius:10px;padding:10px;margin-bottom:10px}.zivv-king-sheet div{display:flex;gap:8px}.zivv-king-sheet button{flex:1;border:0;border-radius:10px;padding:10px;font-weight:800;color:#fff}.zivv-king-sheet #zivv-king-go{background:linear-gradient(135deg,#fcaf45,#e1306c,#833ab4)}.zivv-king-sheet #zivv-king-x{background:#161616}";
        document.head.appendChild(css);
        document.body.appendChild(box);
        document.getElementById("zivv-king-x").onclick = () => box.classList.remove("on");
        document.getElementById("zivv-king-go").onclick = () => {
          const pass = document.getElementById("zivv-king-in").value.trim();
          if (pass === String(kingPass()).trim()) {
            sessionStorage.setItem("zivv.kingOk", "1");
            location.href = "king.html";
          } else {
            window.alert("كلمة المرور غلط.");
          }
        };
      }
      document.getElementById("zivv-king-in").value = "";
      box.classList.add("on");
      setTimeout(() => document.getElementById("zivv-king-in").focus(), 40);
    }
    const start = () => {
      locked = false;
      hold = setTimeout(() => {
        locked = true;
        askKing();
      }, 650);
    };
    const cancel = (ev) => {
      clearTimeout(hold);
      if (locked) ev.preventDefault();
    };
    settingsTile.addEventListener("pointerdown", start);
    settingsTile.addEventListener("pointerup", cancel);
    settingsTile.addEventListener("pointerleave", () => clearTimeout(hold));
    settingsTile.addEventListener("pointercancel", () => clearTimeout(hold));
    settingsTile.addEventListener("click", (ev) => {
      if (locked) ev.preventDefault();
    });
  }

  window.ZIVV = {
    prefs,
    applyFeed,
    summarize() {
      return "";
    },
  };

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    const s = document.createElement("script");
    s.src = src;
    document.head.appendChild(s);
  }
  loadScript("js/supabase-config.js");
  loadScript("js/ads.js?v=19");
  loadScript("js/creator.js");
  setTimeout(() => loadScript("js/db.js"), 30);
  setTimeout(() => loadScript("js/zivvy.js?v=19"), 50);
  setTimeout(() => {
    if (window.ZIVV_ADS && ZIVV_ADS.mount) ZIVV_ADS.mount();
  }, 90);
})();
