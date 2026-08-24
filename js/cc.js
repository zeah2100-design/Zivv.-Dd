(function () {
  const CSS = `
    .zivv-cc { position: relative; display: block; }
    .zivv-cc > video { width: 100%; height: 100%; }
    .zivv-cc-cap {
      position: absolute; left: 10%; right: 10%; bottom: 14%;
      z-index: 7; text-align: center; pointer-events: none;
      font-size: 15px; font-weight: 700; line-height: 1.45; color: #fff;
      text-shadow: 0 1px 2px #000, 0 0 8px #000;
    }
    .zivv-cc-cap span {
      display: inline-block; background: rgba(0,0,0,.45);
      border-radius: 8px; padding: 4px 10px;
    }
    .zivv-cc-gear {
      position: absolute; top: 10px; inset-inline-end: 10px; z-index: 8;
      width: 34px; height: 34px; border: 0; border-radius: 50%;
      background: rgba(0,0,0,.5); color: #fff; font-size: 16px;
    }
    .zivv-cc-sheet {
      display: none; position: fixed; inset: 0; z-index: 85;
      background: rgba(0,0,0,.5);
    }
    .zivv-cc-sheet.open { display: grid; place-items: end center; }
    .zivv-cc-box {
      width: min(420px, 100%); background: #121212;
      border-radius: 16px 16px 0 0; padding: 16px 16px 22px;
      color: #fff; font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    }
    .zivv-cc-box h3 { font-size: 16px; margin: 0 0 6px; }
    .zivv-cc-box p { color: #888; font-size: 13px; margin: 0 0 12px; line-height: 1.55; }
    .zivv-cc-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; padding: 10px 0; border-top: 1px solid #262626;
    }
    .zivv-cc-row b { font-size: 14px; }
    .zivv-cc-sw {
      width: 46px; height: 26px; border-radius: 999px; border: 0;
      background: #333; position: relative;
    }
    .zivv-cc-sw.on { background: linear-gradient(135deg, #fcaf45, #e1306c, #833ab4); }
    .zivv-cc-sw i {
      position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
      border-radius: 50%; background: #fff; transition: transform .18s;
    }
    .zivv-cc-sw.on i { transform: translateX(20px); }
    html[dir="rtl"] .zivv-cc-sw.on i { transform: translateX(-20px); }
    html[dir="rtl"] .zivv-cc-sw i { left: auto; right: 3px; }
    .zivv-cc-lang { font-size: 13px; color: #fcaf45; font-weight: 800; }
    .zivv-cc-x {
      width: 100%; margin-top: 10px; border: 0; border-radius: 12px;
      padding: 11px; background: #1c1c1c; color: #fff; font-weight: 800;
    }
  `;

  const DICT_AR_EN = {
    "اغنيه": "song", "أغنية": "song", "موسيقى": "music", "فيديو": "video",
    "صوره": "photo", "صورة": "photo", "منشور": "post", "تعليق": "comment",
    "لايك": "like", "متابعة": "follow", "حساب": "account", "ملف": "profile",
    "الليل": "night", "ليل": "night", "صباح": "morning", "حب": "love",
    "قلبي": "my heart", "مصر": "Egypt", "القاهره": "Cairo", "القاهرة": "Cairo",
    "الجيزه": "Giza", "الجيزة": "Giza", "اهرامات": "pyramids", "الأهرامات": "the pyramids",
    "نيل": "Nile", "النيل": "the Nile", "مدينه": "city", "مدينة": "city",
    "جديد": "new", "حلوه": "nice", "حلوة": "nice", "جامد": "awesome",
    "شوف": "look", "شوفوا": "watch", "اسمع": "listen", "دلوقتي": "now",
    "النهاردة": "today", "امبارح": "yesterday", "بكره": "tomorrow",
    "اهلا": "hello", "أهلا": "hello", "سلام": "hi", "شكرا": "thanks",
    "شكراً": "thanks", "من فضلك": "please", "اهلا وسهلا": "welcome",
    "فيديو جديد": "new video", "استنى": "wait", "يلا": "let's go"
  };
  const DICT_EN_AR = {};
  Object.keys(DICT_AR_EN).forEach((k) => { DICT_EN_AR[DICT_AR_EN[k]] = k; });

  function prefs() {
    try {
      return Object.assign(
        { hideAI: false, mix70: true, hideVideos: false, photosOnly: false, videoTranslate: true },
        JSON.parse(localStorage.getItem("zivv.prefs") || "{}")
      );
    } catch {
      return { videoTranslate: true };
    }
  }
  function savePrefs(next) {
    localStorage.setItem("zivv.prefs", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("zivv-prefs", { detail: next }));
  }
  function enabled() {
    return prefs().videoTranslate !== false;
  }
  function setEnabled(on) {
    const p = prefs();
    p.videoTranslate = !!on;
    savePrefs(p);
    refreshAll();
    return !!on;
  }
  function appLang() {
    return localStorage.getItem("zivv.lang") === "en" ? "en" : "ar";
  }
  function cache() {
    try { return JSON.parse(localStorage.getItem("zivv.ccCache") || "{}"); }
    catch { return {}; }
  }
  function putCache(k, v) {
    const c = cache();
    c[k] = v;
    const keys = Object.keys(c);
    if (keys.length > 120) delete c[keys[0]];
    localStorage.setItem("zivv.ccCache", JSON.stringify(c));
  }
  function detect(text) {
    const s = String(text || "");
    const ar = (s.match(/[\u0600-\u06FF]/g) || []).length;
    const en = (s.match(/[A-Za-z]/g) || []).length;
    if (ar > en) return "ar";
    if (en > ar) return "en";
    return appLang();
  }
  function localMap(text, to) {
    const dict = to === "en" ? DICT_AR_EN : DICT_EN_AR;
    let out = String(text || "");
    Object.keys(dict)
      .sort((a, b) => b.length - a.length)
      .forEach((k) => {
        const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        out = out.replace(re, dict[k]);
      });
    return out;
  }
  async function translate(text, to) {
    const src = String(text || "").trim();
    if (!src) return "";
    const dest = to || appLang();
    if (detect(src) === dest) return src;
    const key = dest + "::" + src;
    const hit = cache()[key];
    if (hit) return hit;
    try {
      const pair = detect(src) === "ar" ? "ar|en" : "en|ar";
      const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(src.slice(0, 480)) + "&langpair=" + pair;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        const t = j && j.responseData && j.responseData.translatedText;
        if (t && String(t).toLowerCase().indexOf("query length") < 0) {
          putCache(key, t);
          return t;
        }
      }
    } catch {}
    const local = localMap(src, dest);
    putCache(key, local);
    return local;
  }

  function injectCss() {
    if (document.getElementById("zivv-cc-css")) return;
    const s = document.createElement("style");
    s.id = "zivv-cc-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function sheet() {
    let el = document.getElementById("zivv-cc-sheet");
    if (el) return el;
    el = document.createElement("div");
    el.id = "zivv-cc-sheet";
    el.className = "zivv-cc-sheet";
    el.innerHTML = `
      <div class="zivv-cc-box">
        <h3 id="cc-h">ترجمة الفيديوهات</h3>
        <p id="cc-p">الترجمة تظهر على الفيديو بلغة التطبيق — عربي أو إنجليزي.</p>
        <div class="zivv-cc-row">
          <b id="cc-lab">تشغيل الترجمة</b>
          <button type="button" class="zivv-cc-sw" id="cc-sw"><i></i></button>
        </div>
        <div class="zivv-cc-row">
          <b id="cc-ll">لغة الترجمة</b>
          <span class="zivv-cc-lang" id="cc-lang">عربي</span>
        </div>
        <button type="button" class="zivv-cc-x" id="cc-go-set">فتح الإعدادات</button>
        <button type="button" class="zivv-cc-x" id="cc-x">إغلاق</button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => { if (e.target === el) el.classList.remove("open"); });
    document.getElementById("cc-x").onclick = () => el.classList.remove("open");
    document.getElementById("cc-go-set").onclick = () => { location.href = "settings.html"; };
    document.getElementById("cc-sw").onclick = () => {
      setEnabled(!enabled());
      paintSheet();
    };
    return el;
  }
  function paintSheet() {
    const en = appLang() === "en";
    document.getElementById("cc-h").textContent = en ? "Video translation" : "ترجمة الفيديوهات";
    document.getElementById("cc-p").textContent = en
      ? "Captions follow the app language — English or Arabic."
      : "الترجمة تظهر على الفيديو بلغة التطبيق — عربي أو إنجليزي.";
    document.getElementById("cc-lab").textContent = en ? "Turn on translation" : "تشغيل الترجمة";
    document.getElementById("cc-ll").textContent = en ? "Caption language" : "لغة الترجمة";
    document.getElementById("cc-lang").textContent = en ? "English" : "عربي";
    document.getElementById("cc-go-set").textContent = en ? "Open settings" : "فتح الإعدادات";
    document.getElementById("cc-x").textContent = en ? "Close" : "إغلاق";
    document.getElementById("cc-sw").classList.toggle("on", enabled());
  }
  function openSheet() {
    sheet();
    paintSheet();
    document.getElementById("zivv-cc-sheet").classList.add("open");
  }

  function sourceText(post) {
    if (!post) return "";
    return [post.title, post.text].filter(Boolean).join(" — ").trim();
  }
  function postFrom(vid) {
    const host = vid.closest("[data-id]") || vid.parentElement;
    const id = host && host.getAttribute("data-id");
    const cap = (vid.getAttribute("data-caption") || (host && host.getAttribute("data-caption")) || "").trim();
    const list = (window.ZIVV_CORE && ZIVV_CORE.getPosts && ZIVV_CORE.getPosts()) || [];
    const found = list.find((p) => p.id === id);
    if (found) return found;
    return { id: id || "", title: "", text: cap };
  }

  async function fillCap(box, post) {
    const cap = box.querySelector(".zivv-cc-cap");
    if (!cap) return;
    if (!enabled()) { cap.hidden = true; cap.innerHTML = ""; return; }
    const raw = sourceText(post);
    if (!raw) { cap.hidden = true; cap.innerHTML = ""; return; }
    cap.hidden = false;
    cap.innerHTML = "<span>…</span>";
    const t = await translate(raw, appLang());
    if (!box.isConnected) return;
    cap.innerHTML = t ? "<span></span>" : "";
    if (t) cap.querySelector("span").textContent = t;
    cap.hidden = !t;
  }

  function decorate(box) {
    if (box.querySelector(".zivv-cc-gear")) return box;
    const gear = document.createElement("button");
    gear.type = "button";
    gear.className = "zivv-cc-gear";
    gear.setAttribute("aria-label", "cc");
    gear.textContent = "⚙";
    const cap = document.createElement("div");
    cap.className = "zivv-cc-cap";
    cap.hidden = true;
    box.appendChild(gear);
    box.appendChild(cap);
    gear.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSheet();
    });
    return box;
  }
  function wrap(vid) {
    if (!vid) return null;
    const existing = vid.closest(".zivv-cc") || vid.closest(".zivv-cc-host");
    if (existing) return decorate(existing);
    const parent = vid.parentElement;
    if (parent && (parent.classList.contains("clip") || parent.classList.contains("cell") || parent.classList.contains("hero"))) {
      parent.classList.add("zivv-cc-host");
      return decorate(parent);
    }
    const box = document.createElement("div");
    box.className = "zivv-cc";
    vid.parentNode.insertBefore(box, vid);
    box.appendChild(vid);
    return decorate(box);
  }

  function bind(root) {
    injectCss();
    const scope = root || document;
    scope.querySelectorAll("video").forEach((vid) => {
      if (vid.closest("audio")) return;
      const box = wrap(vid);
      if (!box) return;
      fillCap(box, postFrom(vid));
    });
  }
  function refreshAll() {
    document.querySelectorAll(".zivv-cc, .zivv-cc-host").forEach((box) => {
      const vid = box.querySelector("video");
      if (vid) fillCap(box, postFrom(vid));
    });
  }

  window.ZIVV_CC = { bind, translate, enabled, setEnabled, openSheet, appLang };
  window.addEventListener("zivv-lang", refreshAll);
  window.addEventListener("zivv-prefs", refreshAll);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => bind(document));
  else bind(document);
})();
