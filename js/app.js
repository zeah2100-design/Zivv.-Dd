/* ============================================================
   ZIVV — Instagram style app (كل البيانات حقيقية 100%)
   ============================================================ */
"use strict";

/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function toast(msg, type) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast " + (type || "");
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 2600);
}

async function apiGet(path) {
  const r = await fetch("/api" + path, { headers: { Accept: "application/json" } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.error) || ("خطأ " + r.status));
  return data;
}
async function apiPost(path, body) {
  const r = await fetch("/api" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.error) || ("خطأ " + r.status));
  return data;
}
async function apiDel(path) {
  const r = await fetch("/api" + path, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.error) || ("خطأ " + r.status));
  return data;
}

function timeAgo(ts) {
  if (!ts) return "";
  const t = new Date(typeof ts === "number" ? ts : String(ts)).getTime();
  if (!t || isNaN(t)) return "";
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return "منذ " + m + " د";
  const h = Math.floor(m / 60);
  if (h < 24) return "منذ " + h + " س";
  const d = Math.floor(h / 24);
  if (d < 7) return "منذ " + d + " يوم";
  if (d < 30) return "منذ " + Math.floor(d / 7) + " أسبوع";
  const mo = Math.floor(d / 30);
  if (mo < 12) return "منذ " + mo + " شهر";
  return "منذ " + Math.floor(mo / 12) + " سنة";
}

const AVC = ["#d62976", "#fa7e1e", "#962fbf", "#4f5bd5", "#0095f6", "#2eb85c", "#b7791f", "#e1306c"];
function dayLabel(ts) {
  const d = new Date(typeof ts === "number" ? ts : String(ts || ""));
  if (!d || isNaN(d.getTime())) return "";
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yest.toDateString()) return "أمس";
  try { return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" }); } catch { return d.toDateString(); }
}
function avatarColor(key) {
  let h = 0; const s = String(key || "?");
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) >>> 0);
  return AVC[h % AVC.length];
}
function avatarHTML(p, cls, gold) {
  p = p || {};
  const nm = String(p.name || p.username || "?").trim() || "?";
  const init = esc(nm.charAt(0));
  const bg = avatarColor(p.username || nm);
  const av = p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.remove()" />` : "";
  return `<span class="avatar ${cls || ""}${gold ? " gold-ring" : ""}" style="background:${bg}">${init}${av}</span>`;
}

function compressImage(file, maxDim, q) {
  maxDim = maxDim || 1280; q = q || 0.82;
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const sc = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * sc));
        c.height = Math.max(1, Math.round(img.height * sc));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", q));
      } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("تعذر قراءة الصورة")); };
    img.src = url;
  });
}
async function uploadImage(file) {
  const dataUrl = await compressImage(file);
  const out = await apiPost("/upload", { data: dataUrl, mime: "image/jpeg", name: file.name || "img" });
  if (!out.url) throw new Error("فشل الرفع");
  return out.url;
}
function uploadVideo(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const out = await apiPost("/upload", { data: r.result, mime: file.type || "video/mp4", name: file.name || "vid" });
        if (!out.url) throw new Error("فشل الرفع");
        res(out.url);
      } catch (e) { rej(e); }
    };
    r.onerror = () => rej(new Error("تعذر قراءة الفيديو"));
    r.readAsDataURL(file);
  });
}
function pickFile(accept) {
  return new Promise((res) => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = accept || "image/*";
    i.onchange = () => res(i.files && i.files[0]);
    i.click();
  });
}

/* ---------- session ---------- */
let ME = null;
try { ME = JSON.parse(localStorage.getItem("zivv.session") || "null"); } catch {}
if (!ME || !ME.email) location.replace("index.html");
const meKey = () => String((ME && (ME.username || ME.email.split("@")[0])) || "").toLowerCase();
const meName = () => (ME && (ME.name || ME.username)) || "مستخدم";
const isAdmin = () => ["demo", "admin"].includes(meKey());
const OFFICIAL = new Set(["demo", "admin", "zivv"]);

/* ---------- state ---------- */
const S = {
  route: "home",
  timers: [],
  observers: [],
  people: new Map(),
  viewed: new Set(),
  chatPeer: null,
  chatLast: "",
  chatAllSig: "",
  aiChat: null,
  gold: new Set(),
  goldAt: 0,
  drawerCache: null,
  drawerAt: 0,
};
function later(fn, ms) { const id = setInterval(fn, ms); S.timers.push(id); return id; }
function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }
function clearObservers() { S.observers.forEach((o) => { try { o.disconnect(); } catch {} }); S.observers = []; }

/* ---------- modal ---------- */
function openModal(html) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-bg" id="modal-bg"><div class="modal">${html}</div></div>`;
  $("#modal-bg").onclick = (e) => { if (e.target.id === "modal-bg") closeModal(); };
}
function closeModal() { $("#modal-root").innerHTML = ""; }

/* ---------- data: people + gold ---------- */
async function loadPeople() {
  try {
    const [profiles, accounts] = await Promise.all([apiGet("/profiles"), apiGet("/accounts")]);
    const map = new Map();
    (accounts || []).forEach((a) => {
      const u = String(a.username || "").toLowerCase();
      if (u) map.set(u, { username: u, name: a.name || a.username, avatar: "", email: a.email });
    });
    (profiles || []).forEach((p) => {
      const u = String(p.username || "").toLowerCase();
      if (!u) return;
      const prev = map.get(u) || {};
      map.set(u, { username: u, name: p.name || prev.name || u, avatar: p.avatar || prev.avatar || "", bio: p.bio || "", city: p.city || "", email: p.email || prev.email || "" });
    });
    S.people = map;
  } catch {}
  return S.people;
}
function personOf(username) {
  const u = String(username || "").toLowerCase();
  return S.people.get(u) || { username: u, name: username || "مستخدم", avatar: "" };
}
async function loadGold(force) {
  if (!force && Date.now() - S.goldAt < 60000 && S.gold) return S.gold;
  try {
    const rows = await apiGet("/gold");
    S.gold = new Set((rows || []).filter((g) => g.status === "approved").map((g) => String(g.username || "").toLowerCase()));
    S.goldAt = Date.now();
  } catch {}
  return S.gold;
}
const isGold = (u) => S.gold.has(String(u || "").toLowerCase());
const vBadge = (u) => OFFICIAL.has(String(u || "").toLowerCase()) ? `<span class="vbadge" title="حساب موثق">✓</span>` : "";
const gBadge = (u) => isGold(u) ? `<span class="gbadge" title="عضو ذهبي">👑</span>` : "";
function nameBadges(u) { return vBadge(u) + gBadge(u); }

async function notifyOwner(post, kind, previewText) {
  try {
    const owner = String(post.username || post.user || "").toLowerCase();
    if (!owner || owner === meKey()) return;
    await apiPost("/notes", {
      dest: owner,
      type: kind === "like" ? "like" : "comment",
      title: kind === "like" ? "إعجاب جديد" : "تعليق جديد",
      body: kind === "like" ? `${meName()} أعجب بمنشورك` : `${meName()}: ${String(previewText || "").slice(0, 90)}`,
      from_user: meKey(), from_name: meName(),
      post_id: post.id, unread: true,
    });
  } catch {}
}

/* ---------- topbar + drawer + bottomnav ---------- */
const MAIN_ROUTES = ["home", "explore", "create", "reels", "profile"];
function isMainRoute(name, params) {
  if (!MAIN_ROUTES.includes(name)) return false;
  if (name === "profile" && params.get("u") && params.get("u").toLowerCase() !== meKey()) return false;
  return true;
}
function renderTopbar(name, title, params) {
  const tb = $("#tb-inner");
  if (isMainRoute(name, params)) {
    tb.innerHTML = `
      <button class="icon-btn" id="tb-menu" title="القائمة">☰</button>
      <a class="tb-logo" href="#/home"><img src="brand/logo-sm.png" alt="ZIVV" />ZIVV</a>
      <span class="tb-spacer"></span>
      <button class="icon-btn" id="tb-theme" title="ليلي / نهاري">${document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙"}</button>
      <a class="icon-btn" href="#/notes" title="الإشعارات">🤍<span class="bdg" id="tb-notes-bdg" style="display:none">0</span></a>
      <a class="icon-btn" href="#/chat" title="الدردشة">💬</a>`;
    $("#tb-menu").onclick = openDrawer;
    $("#tb-theme").onclick = toggleTheme;
  } else {
    tb.innerHTML = `
      <button class="icon-btn" id="tb-back" title="رجوع">→</button>
      <h1 class="tb-title">${esc(title)}</h1>
      <a class="icon-btn" href="#/home" title="الرئيسية">🏠</a>`;
    $("#tb-back").onclick = () => { if (history.length > 1) history.back(); else location.hash = "#/home"; };
  }
}
function toggleTheme() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  if (dark) { document.documentElement.removeAttribute("data-theme"); try { localStorage.setItem("zivv.theme", "light"); } catch {} }
  else { document.documentElement.setAttribute("data-theme", "dark"); try { localStorage.setItem("zivv.theme", "dark"); } catch {} }
  render();
}
function setBottomNav(name, params) {
  const bn = $("#bottomnav");
  const show = isMainRoute(name, params);
  bn.classList.toggle("hide", !show);
  $("#content").classList.toggle("no-bottom", !show);
  $$("#bottomnav a").forEach((a) => a.classList.toggle("active", a.getAttribute("data-route") === name));
}

async function drawerStats() {
  if (S.drawerCache && Date.now() - S.drawerAt < 30000) return S.drawerCache;
  try {
    const [posts, follows] = await Promise.all([apiGet("/posts?limit=500"), apiGet("/follows")]);
    const me = meKey();
    const out = {
      posts: (posts || []).filter((p) => String(p.username || p.user || "").toLowerCase() === me).length,
      followers: (follows || []).filter((f) => String(f.following || f.to_user || "").toLowerCase() === me).length,
      following: (follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === me).length,
    };
    S.drawerCache = out; S.drawerAt = Date.now();
    return out;
  } catch { return { posts: 0, followers: 0, following: 0 }; }
}
async function renderDrawer() {
  const me = personOf(meKey());
  const st = await drawerStats();
  const d = $("#drawer");
  d.innerHTML = `
    <div class="drawer-profile">
      <div class="row">
        ${avatarHTML({ ...me, name: meName() }, "", isGold(meKey()))}
        <div><h3>${esc(meName())} ${nameBadges(meKey())}</h3><div class="u">@${esc(meKey())}</div></div>
      </div>
      <div class="drawer-stats">
        <div><b>${st.posts}</b><small>منشور</small></div>
        <div><b>${st.followers}</b><small>متابِع</small></div>
        <div><b>${st.following}</b><small>يتابع</small></div>
      </div>
    </div>
    <nav class="drawer-menu">
      <a class="drawer-link" href="#/home"><span class="ico">🏠</span> الرئيسية</a>
      <a class="drawer-link" href="#/explore"><span class="ico">🔍</span> استكشاف</a>
      <a class="drawer-link" href="#/reels"><span class="ico">🎬</span> ريلز وفيديو</a>
      <a class="drawer-link" href="#/videos"><span class="ico">▶️</span> فيديو</a>
      <a class="drawer-link" href="#/music"><span class="ico">🎵</span> موسيقى</a>
      <a class="drawer-link" href="#/create"><span class="ico">➕</span> إنشاء جديد</a>
      <a class="drawer-link" href="#/store"><span class="ico">🛍️</span> السوق</a>
      <a class="drawer-link" href="#/chat"><span class="ico">💬</span> الدردشة</a>
      <a class="drawer-link" href="#/private"><span class="ico">🔒</span> دردشة خاصة</a>
      <a class="drawer-link" href="#/friends"><span class="ico">👥</span> الأصدقاء</a>
      <a class="drawer-link" href="#/ai"><span class="ico">✨</span> زيفي AI</a>
      <a class="drawer-link" href="#/settings"><span class="ico">⚙️</span> الإعدادات</a>
      <a class="drawer-link" href="#/notes"><span class="ico">🤍</span> الإشعارات <span class="bdg" id="drawer-notes-bdg" style="display:none">0</span></a>
      <a class="drawer-link" href="#/profile"><span class="ico">👤</span> حسابي</a>
      <a class="drawer-link gold-link" href="#/gold"><span class="ico">👑</span> الاشتراك الذهبي</a>
      ${isAdmin() ? `<a class="drawer-link" href="#/king"><span class="ico">🛡️</span> صفحة الملك</a>` : ""}
      <a class="drawer-link" href="#/stats"><span class="ico">📊</span> الإحصائيات</a>
    </nav>
    <div class="drawer-foot">
      <button class="btn ghost sm" id="drawer-theme" style="flex:1">🌙 / ☀️</button>
      <button class="btn ghost sm" id="drawer-logout" style="flex:1">خروج ⎋</button>
    </div>`;
  $$("#drawer .drawer-link").forEach((a) => a.addEventListener("click", closeDrawer));
  $("#drawer-theme").onclick = () => { closeDrawer(); toggleTheme(); };
  $("#drawer-logout").onclick = () => {
    if (!confirm("تسجيل الخروج؟")) return;
    localStorage.removeItem("zivv.session");
    location.replace("index.html");
  };
  // الدخول المخفي للملك: ضغط مطوّل 60 ثانية على رقم النسخة
  const avt = $("#app-ver");
  let holdT = null;
  const holdStart = (e) => {
    if (e) e.preventDefault();
    toast("استمر بالضغط 60 ثانية لفتح دخول الملك…");
    holdT = setTimeout(() => { closeDrawer(); location.hash = "#/king"; }, 60000);
  };
  const holdEnd = () => { if (holdT) { clearTimeout(holdT); holdT = null; } };
  if (avt) {
    avt.addEventListener("mousedown", holdStart);
    avt.addEventListener("touchstart", holdStart, { passive: false });
    avt.addEventListener("mouseup", holdEnd);
    avt.addEventListener("mouseleave", holdEnd);
    avt.addEventListener("touchend", holdEnd);
  }
  updateBadge();
}
function openDrawer() { renderDrawer(); $("#drawer").classList.add("open"); $("#drawer-bg").classList.add("open"); }
function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer-bg").classList.remove("open"); }

/* ---------- post card (IG) ---------- */
function mediaOf(p) {
  const v = p.video_url || p.videoId || p.video || "";
  const img = p.image || p.image_url || "";
  const a = p.audio_url || p.audioId || "";
  if (v) return { kind: "video", src: v };
  if (a) return { kind: "audio", src: a, cover: img };
  if (img) return { kind: "image", src: img };
  return null;
}
function postCard(p, ctx) {
  ctx = ctx || {};
  const uname = String(p.username || p.user || "");
  const owner = personOf(uname);
  const liked = !!ctx.liked;
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const m = mediaOf(p);
  const media = m
    ? (m.kind === "video"
      ? `<video class="post-media" src="${esc(m.src)}" controls playsinline preload="metadata"></video>`
      : `<img class="post-media" src="${esc(m.src)}" alt="" loading="lazy" />`)
    : "";
  return `
  <article class="card post" data-post="${esc(p.id)}">
    <div class="post-head">
      ${avatarHTML({ ...owner, name: p.name || owner.name }, "sm", isGold(uname))}
      <div class="who">
        <b><a href="#/profile?u=${encodeURIComponent(uname)}">${esc(p.name || owner.name || "")}</a> ${nameBadges(uname)}</b>
        <span>@${esc(uname)} · ${esc(timeAgo(p.created_at))}</span>
      </div>
      <button class="post-dots" data-dots="${esc(p.id)}">•••</button>
    </div>
    ${p.title ? `<div class="post-title">${esc(p.title)}</div>` : ""}
    ${p.body || p.text ? `<p class="post-body">${esc(p.body || p.text || "")}</p>` : ""}
    ${media}
    ${tags.length ? `<div class="post-tags">${tags.map((t) => `<span class="tag" data-tag="${esc(t)}">#${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="post-actions">
      <button class="act ${liked ? "liked" : ""}" data-like="${esc(p.id)}"><span class="ei">${liked ? "❤️" : "🤍"}</span><span class="n" data-likes-n>${ctx.likes || 0}</span></button>
      <button class="act" data-comments="${esc(p.id)}"><span class="ei">💬</span><span class="n" data-comments-n>${ctx.comments || 0}</span></button>
      <button class="act" data-share="${esc(p.id)}"><span class="ei">✈️</span></button>
      <span style="flex:1"></span>
      <span class="act static"><span class="ei" style="font-size:19px">👁️</span><span class="n" dataeated_at))}</div>
    <div class="comments" id="c-${esc(p.id)}"></div>
  </article>`;
}

function bindFeed(root, posts) {
  $$("[data-like]", root).forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-like");
      const on = !btn.classList.contains("liked");
      btn.classList.toggle("liked", on);
      btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
      $(".ei", btn).textContent = on ? "❤️" : "👍";
      const card = btn.closest("[data-post]");
      const cur = parseInt(($("[data-likes-n]", btn).textContent || "0"), 10) || 0;
      const nv = String(Math.max(0, cur + (on ? 1 : -1)));
      $("[data-likes-n]", btn).textContent = nv;
      const l2 = $("[data-likes-n2]", card); if (l2) l2.textContent = nv;
      try {
        await apiPost("/likes", { post_id: id, user_key: meKey(), on });
        if (on) { const p = (posts || []).find((x) => String(x.id) === String(id)); if (p) notifyOwner(p, "like"); }
      } catch { toast("تعذر تسجيل الإعجاب", "err"); }
    };
  });
  $$("[data-comments]", root).forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); toggleComments(btn.getAttribute("data-comments"), posts); };
  });
  $$("[data-share]", root).forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-share");
      const link = location.origin + location.pathname + "#/post/" + id;
      try { await navigator.clipboard.writeText(link); toast("تم نسخ رابط المنشور", "ok"); }
      catch { prompt("انسخ الرابط:", link); }
    };
  });
  $$("[data-dots]", root).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-dots");
      const p = (posts || []).find((x) => String(x.id) === String(id));
      const mine = p && String(p.username || p.user || "").toLowerCase() === meKey();
      openModal(`<h3>خيارات المنشور</h3><div class="menu-list">
        <button data-m="copy">🔗 نسخ الرابط</button>
        <button data-m="open">🔍 فتح المنشور</button>
        ${mine ? `<button data-m="del" class="danger">🗑️ حذف المنشور</button>` : `<button data-m="report" class="danger">🚩 إبلاغ عن المنشور</button>`}
        <button data-m="x">إلغاء</button>
      </div>`);
      $$("#modal-root [data-m]").forEach((b) => (b.onclick = async () => {
        const m = b.getAttribute("data-m");
        closeModal();
        if (m === "copy") {
          try { await navigator.clipboard.writeText(location.origin + location.pathname + "#/post/" + id); toast("تم نسخ الرابط", "ok"); } catch {}
        } else if (m === "open") { location.hash = "#/post/" + id; }
        else if (m === "del") {
          if (!confirm("حذف هذا المنشور نهائياً؟")) return;
          try { await apiDel("/posts?id=" + encodeURIComponent(id) + "&user=" + encodeURIComponent(meKey())); toast("تم الحذف", "ok"); render(); }
          catch { toast("تعذر الحذف", "err"); }
        } else if (m === "report") { openReportModal(p); }
      }));
    };
  });
  $$("[data-tag]", root).forEach((t) => {
    t.onclick = () => { location.hash = "#/explore?q=" + encodeURIComponent(t.getAttribute("data-tag")); };
  });
  // تسجيل المشاهدات الحقيقية
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.getAttribute("data-post");
      io.unobserve(en.target);
      if (!id || S.viewed.has(id)) return;
      S.viewed.add(id);
      apiPost("/views", { post_id: id, user_key: meKey() }).then((out) => {
        const card = root.querySelector(`[data-post="${CSS.escape(id)}"] [data-views-n]`);
        if (card && out && typeof out.views === "number") card.textContent = String(out.views);
      }).catch(() => {});
    });
  }, { threshold: 0.4 });
  S.observers.push(io);
  $$(".post[data-post]", root).forEach((el) => io.observe(el));
}

function openReportModal(p) {
  if (!p) return;
  openModal(`<h3>🚩 إبلاغ عن منشور</h3>
    <div class="field"><label>السبب</label>
      <select class="input" id="rep-reason">
        <option>محتوى مسيء</option><option>احتيال أو نصب</option>
        <option>محتوى جنسي</option><option>عنف أو كراهية</option><option>أخرى</option>
      </select></div>
    <div class="field"><label>تفاصيل (اختياري)</label><input class="input" id="rep-note" placeholder="اشرح المشكلة…" /></div>
    <button class="btn danger block" id="rep-send">إرسال البلاغ</button>`);
  $("#rep-send").onclick = async () => {
    try {
      await apiPost("/reports", {
        post_id: p.id, target_user: p.username || p.user || "", type: "post", dest: "king",
        reporter_name: meName(), reporter_email: ME.email,
        note: $("#rep-reason").value + ( $("#rep-note").value.trim() ? " — " + $("#rep-note").value.trim() : ""),
      });
      closeModal(); toast("تم إرسال البلاغ للإدارة", "ok");
    } catch { toast("تعذر إرسال البلاغ", "err"); }
  };
}

async function toggleComments(postId, posts) {
  const box = document.getElementById("c-" + postId);
  if (!box) return;
  if (box.classList.contains("open") && box.dataset.loaded) { box.classList.remove("open"); return; }
  box.classList.add("open");
  if (!box.dataset.loaded) {
    box.innerHTML = `<p style="color:var(--muted);font-size:13px">جاري تحميل التعليقات…</p>`;
    try {
      const list = await apiGet("/comments?post_id=" + encodeURIComponent(postId));
      box.dataset.loaded = "1";
      paintComments(box, postId, list || [], posts);
    } catch { box.innerHTML = `<p style="color:var(--red);font-size:13px">تعذر تحميل التعليقات</p>`; }
  }
}
function paintComments(box, postId, list, posts) {
  const items = (list || []).map((c) => {
    const who = personOf(c.user_key);
    return `<div class="comment">${avatarHTML({ ...who, name: c.name || who.name }, "sm")}
      <div class="bubble"><b>${esc(c.name || who.name || "")}</b> ${esc(c.body || "")}<time>${esc(timeAgo(c.created_at))}</time></div></div>`;
  }).join("");
  box.innerHTML = `${items || `<p style="color:var(--muted);font-size:13px">لا توجد تعليقات بعد — كن أول من يعلق.</p>`}
    <form class="comment-form" data-cform="${esc(postId)}">
      <input class="input" placeholder="أضف تعليقاً…" required maxlength="500" />
      <button class="btn sm" type="submit">نشر</button>
    </form>`;
  const form = $("[data-cform]", box);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const inp = $("input", form);
    const body = inp.value.trim();
    if (!body) return;
    inp.disabled = true;
    try {
      await apiPost("/comments", { post_id: postId, name: meName(), user_key: meKey(), body });
      const fresh = await apiGet("/comments?post_id=" + encodeURIComponent(postId));
      paintComments(box, postId, fresh || [], posts);
      const card = document.querySelector(`[data-post="${CSS.escape(postId)}"] [data-comments-n]`);
      if (card) card.textContent = String((fresh || []).length);
      const p = (posts || []).find((x) => String(x.id) === String(postId));
      if (p) notifyOwner(p, "comment", body);
    } catch { toast("تعذر نشر التعليق", "err"); inp.disabled = false; }
  };
}

/* ---------- stories ---------- */
function seenStories() {
  try { return new Set(JSON.parse(localStorage.getItem("zivv.seenStories") || "[]")); } catch { return new Set(); }
}
function markStorySeen(id) {
  try {
    const s = seenStories(); s.add(String(id));
    localStorage.setItem("zivv.seenStories", JSON.stringify(Array.from(s).slice(-300)));
  } catch {}
}
async function viewHome(el) {
  el.innerHTML = `<div class="wrap-narrow">
    <div class="stories" id="stories-row"></div>
    <div class="card composer">
      <div class="row">${avatarHTML({ username: meKey(), name: meName(), avatar: (personOf(meKey()) || {}).avatar }, "sm")}
        <textarea id="composer-text" placeholder="شارك لحظتك…" rows="1"></textarea>
      </div>
      <div class="img-preview" id="composer-prev"><span id="composer-prev-media"></span><button type="button" id="composer-media-x">✕</button></div>
      <div class="tools">
        <button class="tool-btn" id="composer-img" type="button">🖼️ صورة</button>
        <button class="tool-btn" id="composer-vid" type="button">🎬 فيديو</button>
        <span style="flex:1"></span>
        <button class="btn sm" id="composer-send" type="button">مشاركة</button>
      </div>
    </div>
    <div id="feed-list"><div class="skel"></div><div class="skel"></div></div>
  </div>`;

  let pendingMedia = "", pendingKind = "";
  $("#composer-img").onclick = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    toast("جاري رفع الصورة…");
    try {
      pendingMedia = await uploadImage(f); pendingKind = "image";
      $("#composer-prev-media").innerHTML = `<img src="${esc(pendingMedia)}" alt="" />`;
      $("#composer-prev").classList.add("show");
      toast("تم الرفع", "ok");
    } catch { toast("تعذر الرفع", "err"); }
  };
  $("#composer-vid").onclick = async () => {
    const f = await pickFile("video/*");
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast("الفيديو أكبر من 10MB", "err"); return; }
    toast("جاري رفع الفيديو…");
    try {
      pendingMedia = await uploadVideo(f); pendingKind = "video";
      $("#composer-prev-media").innerHTML = `<video src="${esc(pendingMedia)}" controls></video>`;
      $("#composer-prev").classList.add("show");
      toast("تم الرفع", "ok");
    } catch { toast("تعذر الرفع", "err"); }
  };
  $("#composer-media-x").onclick = () => { pendingMedia = ""; pendingKind = ""; $("#composer-prev").classList.remove("show"); };
  $("#composer-send").onclick = async () => {
    const ta = $("#composer-text");
    const body = ta.value.trim();
    if (!body && !pendingMedia) { toast("اكتب شيئاً أو أرفق وسائط", "err"); return; }
    const btn = $("#composer-send");
    btn.disabled = true; btn.textContent = "جاري النشر…";
    try {
      await apiPost("/posts", {
        username: meKey(), name: meName(),
        avatar: (personOf(meKey()) || {}).avatar || "",
        title: "", body,
        type: pendingKind === "video" ? "video" : (pendingKind === "image" ? "image" : "text"),
        image_url: pendingKind === "image" ? pendingMedia : "",
        video_url: pendingKind === "video" ? pendingMedia : "",
        tags: [], dests: ["home", "explore"], status: "ok",
      });
      toast("تم النشر", "ok");
      viewHome(el);
    } catch { toast("تعذر النشر", "err"); btn.disabled = false; btn.textContent = "مشاركة"; }
  };

  loadStoriesRow();
  try {
    await Promise.all([loadPeople(), loadGold()]);
    const [posts, likes, comments, views] = await Promise.all([
      apiGet("/posts?limit=200"), apiGet("/likes"), apiGet("/comments"), apiGet("/views"),
    ]);
    const likeCount = {}, likedByMe = new Set();
    (likes || []).forEach((l) => {
      likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1;
      if (String(l.user_key || "").toLowerCase() === meKey()) likedByMe.add(String(l.post_id));
    });
    const commentCount = {};
    (comments || []).forEach((c) => { commentCount[c.post_id] = (commentCount[c.post_id] || 0) + 1; });
    const viewCount = (views && views.counts) || {};
    const list = $("#feed-list");
    if (!list) return;
    if (!posts || !posts.length) {
      list.innerHTML = `<div class="card empty"><span class="big">📸</span>لا توجد منشورات بعد.<br/>شارك أول لحظة من الأعلى.</div>`;
      return;
    }
    list.innerHTML = posts.map((p) => postCard(p, {
      likes: likeCount[p.id] || 0, liked: likedByMe.has(String(p.id)),
      comments: commentCount[p.id] || 0, views: viewCount[p.id] || 0,
    })).join("");
    bindFeed(list, posts);
  } catch {
    const l = $("#feed-list");
    if (l) l.innerHTML = `<div class="card empty"><span class="big">⚠️</span>تعذر التحميل.<br/><button class="btn sm" onclick="location.reload()">إعادة المحاولة</button></div>`;
  }
}

async function loadStoriesRow() {
  const row = $("#stories-row");
  if (!row) return;
  const me = personOf(meKey());
  let groups = [];
  try {
    const all = await apiGet("/stories");
    const map = new Map();
    (all || []).forEach((s) => {
      const u = String(s.username || s.user || "").toLowerCase();
      if (!u) return;
      if (!map.has(u)) map.set(u, []);
      map.get(u).push(s);
    });
    groups = Array.from(map.entries()).map(([u, arr]) => {
      arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return { user: u, items: arr, last: arr[arr.length - 1] };
    }).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at)).slice(0, 15);
  } catch {}
  const seen = seenStories();
  row.innerHTML = `
    <button class="story-item story-add" id="story-add">
      <span class="story-ring"><span class="in" style="background:${avatarColor(meKey())}">${esc(meName().charAt(0))}${me.avatar ? `<img src="${esc(me.avatar)}" onerror="this.remove()" />` : ""}<span class="plus">+</span></span></span>
      <span>قصتك</span>
    </button>` +
    groups.map((g) => {
      const who = personOf(g.user);
      const allSeen = g.items.every((s) => seen.has(String(s.id)));
      const first = g.items[0];
      const thumb = first.image_url || first.image ? `<img src="${esc(first.image_url || first.image)}" onerror="this.remove()" />` : (who.avatar ? `<img src="${esc(who.avatar)}" onerror="this.remove()" />` : "");
      return `<button class="story-item" data-story-user="${esc(g.user)}">
        <span class="story-ring ${allSeen ? "seen" : ""}"><span class="in" style="background:${avatarColor(g.user)}">${esc((who.name || g.user).charAt(0))}${thumb}</span></span>
        <span>${esc(g.user === meKey() ? "قصتك" : (who.name || g.user))}</span>
      </button>`;
    }).join("");
  $("#story-add").onclick = openAddStory;
  $$("#stories-row [data-story-user]").forEach((b) => (b.onclick = () => openStoryViewer(groups, b.getAttribute("data-story-user"))));
}

function openAddStory() {
  openModal(`<h3>📸 ستوري جديدة</h3>
    <div class="field"><textarea class="textarea" id="story-text" placeholder="اكتب شيئاً…" style="min-height:80px"></textarea></div>
    <div class="field"><button class="btn soft block" id="story-img-btn" type="button">🖼️ إرفاق صورة (اختياري)</button>
    <div id="story-img-prev" style="margin-top:8px"></div></div>
    <button class="btn block" id="story-send">نشر الستوري</button>`);
  let img = "";
  $("#story-img-btn").onclick = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    toast("جاري الرفع…");
    try { img = await uploadImage(f); $("#story-img-prev").innerHTML = `<img src="${esc(img)}" style="border-radius:12px;max-height:160px" />`; }
    catch { toast("تعذر الرفع", "err"); }
  };
  $("#story-send").onclick = async () => {
    const body = $("#story-text").value.trim();
    if (!body && !img) { toast("اكتب شيئاً أو أرفق صورة", "err"); return; }
    try {
      await apiPost("/stories", {
        username: meKey(), name: meName(),
        avatar: (personOf(meKey()) || {}).avatar || "",
        kind: img ? "image" : "text", body, image_url: img,
      });
      closeModal(); toast("تم نشر الستوري", "ok"); loadStoriesRow();
    } catch { toast("تعذر النشر", "err"); }
  };
}

function openStoryViewer(groups, startUser) {
  let gi = Math.max(0, groups.findIndex((g) => g.user === startUser));
  let si = 0, timer = null;
  const root = document.createElement("div");
  root.className = "story-viewer";
  root.id = "story-viewer";
  document.body.appendChild(root);
  function render() {
    const g = groups[gi];
    if (!g) { close(); return; }
    const s = g.items[si];
    const who = personOf(g.user);
    markStorySeen(s.id);
    const media = (s.image_url || s.image)
      ? `<img class="sv-media" src="${esc(s.image_url || s.image)}" />`
      : `<div class="sv-text">${esc(s.body || "")}</div>`;
    root.innerHTML = `<div class="sv-box">
      <div class="sv-top">
        <div class="sv-progress">${g.items.map((_, i) => `<i class="${i < si ? "done" : (i === si ? "now" : "")}"></i>`).join("")}</div>
        <div class="sv-user">${avatarHTML(who, "sm")}<div><b>${esc(who.name || g.user)}</b><br/><small>${esc(timeAgo(s.created_at))}</small></div>
        <button class="sv-x" id="sv-x">✕</button></div>
      </div>
      ${media}
      <div class="sv-zone sv-prev" id="sv-prev"></div>
      <div class="sv-zone sv-next" id="sv-next"></div>
    </div>`;
    $("#sv-x", root).onclick = (e) => { e.stopPropagation(); close(); };
    $("#sv-prev", root).onclick = () => step(-1);
    $("#sv-next", root).onclick = () => step(1);
    clearTimeout(timer);
    timer = setTimeout(() => step(1), 5000);
  }
  function step(d) {
    clearTimeout(timer);
    si += d;
    if (si >= groups[gi].items.length) { gi++; si = 0; }
    if (si < 0) { gi--; if (gi >= 0) si = groups[gi].items.length - 1; }
    if (gi < 0) { gi = 0; si = 0; }
    if (gi >= groups.length) { close(); return; }
    render();
  }
  function close() { clearTimeout(timer); root.remove(); loadStoriesRow(); }
  root.onclick = (e) => { if (e.target === root) close(); };
  render();
}

/* ---------- explore ---------- */
async function viewExplore(el, params) {
  const q0 = params.get("q") || "";
  const tab0 = params.get("tab") || "all";
  el.innerHTML = `<div class="wrap-wide">
    <div class="tt-search"><div class="box">🔍
      <input id="ex-q" placeholder="بحث في ZIVV…" value="${esc(q0)}" />
      <button class="go" id="ex-go">بحث</button>
    </div></div>
    <div class="tt-chips" id="ex-trend"></div>
    <div class="tt-tabs" id="ex-tabs">
      <button class="tt-tab" data-xtab="all">الكل</button>
      <button class="tt-tab" data-xtab="users">مستخدمون</button>
      <button class="tt-tab" data-xtab="videos">فيديو</button>
      <button class="tt-tab" data-xtab="music">موسيقى</button>
      <button class="tt-tab" data-xtab="tags">هاشتاج</button>
      <button class="tt-tab" data-xtab="products">منتجات</button>
    </div>
    <div id="ex-body"><div class="skel"></div><div class="skel"></div></div>
  </div>`;
  let DATA = null, curTab = tab0;
  async function load() {
    await Promise.all([loadPeople(), loadGold()]);
    const [posts, likes, follows, views, products] = await Promise.all([
      apiGet("/posts?limit=200"), apiGet("/likes"), apiGet("/follows"), apiGet("/views"), apiGet("/products").catch(() => []),
    ]);
    const likeCount = {};
    (likes || []).forEach((l) => { likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1; });
    const viewCount = (views && views.counts) || {};
    const following = new Set((follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === meKey()).map((f) => String(f.following || f.to_user || "").toLowerCase()));
    const tagCount = {};
    (posts || []).forEach((p) => (Array.isArray(p.tags) ? p.tags : []).forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    DATA = { posts: posts || [], likeCount, viewCount, following, tagCount, products: products || [] };
    const top = Object.keys(tagCount).sort((x, y) => tagCount[y] - tagCount[x]).slice(0, 10);
    const tr = $("#ex-trend");
    if (tr) tr.innerHTML = top.length ? top.map((t, i) => `<button class="tt-chip" data-trend="${esc(t)}"><b>${i + 1}</b> #${esc(t)}</button>`).join("") : "";
    $$("#ex-trend [data-trend]").forEach((c) => (c.onclick = () => { $("#ex-q").value = c.getAttribute("data-trend"); curTab = "all"; paint(); }));
    paint();
  }
  function paint() {
    $$("#ex-tabs .tt-tab").forEach((t) => t.classList.toggle("active", t.getAttribute("data-xtab") === curTab));
    const box = $("#ex-body");
    if (!box || !DATA) return;
    const q = (($("#ex-q") || {}).value || "").trim().toLowerCase();
    const { posts, likeCount, viewCount, following, tagCount, products } = DATA;
    const matchP = (p) => !q || ((p.title || "") + " " + (p.body || p.text || "") + " " + ((p.tags || []).join(" "))).toLowerCase().includes(q);
    const users = Array.from(S.people.values()).filter((u) => u.username !== meKey());
    const fUsers = q ? users.filter((u) => (u.name + " " + u.username).toLowerCase().includes(q)) : users.slice(0, 6);
    const fPosts = posts.filter(matchP);
    const fVideos = fPosts.filter((p) => mediaOf(p) && mediaOf(p).kind === "video");
    const fMusic = fPosts.filter((p) => (mediaOf(p) && mediaOf(p).kind === "audio") || p.type === "music");
    const fTags = Object.keys(tagCount).filter((t) => !q || t.toLowerCase().includes(q)).sort((x, y) => tagCount[y] - tagCount[x]).slice(0, 20);
    const fProds = (products || []).filter((p) => !q || ((p.title || "") + " " + (p.description || "") + " " + (p.cat || "")).toLowerCase().includes(q)).slice(0, 12);
    const uRow = (u) => {
      const isF = following.has(u.username);
      return `<div class="user-row">${avatarHTML(u, "sm", isGold(u.username))}
        <div class="who"><b><a href="#/profile?u=${encodeURIComponent(u.username)}">${esc(u.name)}</a> ${nameBadges(u.username)}</b><span>@${esc(u.username)}</span></div>
        <button class="btn ${isF ? "ghost" : "soft"} sm" data-follow="${esc(u.username)}" data-on="${isF ? "0" : "1"}">${isF ? "إلغاء" : "متابعة"}</button></div>`;
    };
    const vCell = (p) => `<div class="tt-video" data-open="${esc(p.id)}"><video src="${esc(mediaOf(p).src)}" preload="metadata" muted playsinline></video><span class="vc">▶ ${(viewCount[p.id] || 0).toLocaleString("en")}</span></div>`;
    const sRow = (p) => {
      const m = mediaOf(p) || {};
      return `<div class="tt-songrow">${m.cover ? `<img class="cv" src="${esc(m.cover)}" />` : `<span class="cv">🎵</span>`}
        <div style="flex:1;min-width:0"><b style="font-size:14px">${esc(p.title || "مقطع صوتي")}</b><br/><small style="color:var(--muted)">${esc(p.name || "")}</small></div>
        <audio src="${esc(m.src || "")}" controls preload="none"></audio></div>`;
    };
    let html = "";
    const show = (t) => curTab === "all" || curTab === t;
    if (show("users") && fUsers.length) html += `<div class="card" style="padding:8px 14px;margin-bottom:10px"><b style="font-size:14px">👥 المستخدمون</b>${fUsers.map(uRow).join("")}</div>`;
    if (show("videos") && fVideos.length) html += `<b style="font-size:14px">🎬 فيديو</b><div class="tt-videos" style="margin:8px 0 14px">${fVideos.slice(0, 12).map(vCell).join("")}</div>`;
    if (show("music") && fMusic.length) html += `<b style="font-size:14px">🎵 موسيقى</b><div style="margin:8px 0 14px">${fMusic.slice(0, 8).map(sRow).join("")}</div>`;
    if (show("tags") && fTags.length) html += `<b style="font-size:14px"># هاشتاج</b><div style="margin:8px 0 14px">${fTags.map((t) => `<div class="tt-tagrow" data-taggo="${esc(t)}"><span class="h">#</span><div><b>#${esc(t)}</b><br/><small style="color:var(--muted)">${tagCount[t]} منشور</small></div></div>`).join("")}</div>`;
    if (show("products") && fProds.length) html += `<b style="font-size:14px">🛍️ منتجات</b><div class="store-grid" style="margin:8px 0 14px">${fProds.map((p) => `<div class="product-card" data-prod="${esc(p.title || "")}">${p.image_url ? `<img class="pimg" src="${esc(p.image_url)}" loading="lazy" />` : `<div class="pimg-ph">📦</div>`}<div class="pbody"><b>${esc(p.title || "")}</b><span class="price">${esc(String(p.price == null ? 0 : p.price))} ج.م</span></div></div>`).join("")}</div>`;
    if (show("users") && !fUsers.length && curTab === "users") html = `<div class="card empty"><span class="big">🔍</span>لا يوجد مستخدمون.</div>`;
    if (!html) html = `<div class="card empty"><span class="big">🔍</span>لا توجد نتائج.</div>`;
    box.innerHTML = html;
    $$("[data-follow]", box).forEach((b) => (b.onclick = async () => {
      try { await apiPost("/follows", { from_user: meKey(), to_user: b.getAttribute("data-follow"), on: b.getAttribute("data-on") === "1" }); toast("تم", "ok"); load(); }
      catch { toast("تعذر التنفيذ", "err"); }
    }));
    $$("[data-open]", box).forEach((c) => (c.onclick = () => { location.hash = "#/post/" + c.getAttribute("data-open"); }));
    $$("[data-taggo]", box).forEach((c) => (c.onclick = () => { $("#ex-q").value = c.getAttribute("data-taggo"); curTab = "all"; paint(); }));
    $$("[data-prod]", box).forEach((c) => (c.onclick = () => { location.hash = "#/store?q=" + encodeURIComponent(c.getAttribute("data-prod")); }));
  }
  $$("#ex-tabs .tt-tab").forEach((t) => (t.onclick = () => { curTab = t.getAttribute("data-xtab"); paint(); }));
  let deb = null;
  $("#ex-q").oninput = () => { clearTimeout(deb); deb = setTimeout(paint, 350); };
  $("#ex-go").onclick = paint;
  load();
}

async function viewReels(el) {
  el.innerHTML = `<div class="wrap-narrow"><div id="reels-box"><div class="skel"></div><div class="skel"></div></div></div>`;
  try {
    await Promise.all([loadPeople(), loadGold()]);
    const [posts, likes, comments, views, follows] = await Promise.all([
      apiGet("/posts?limit=200"), apiGet("/likes"), apiGet("/comments"), apiGet("/views"), apiGet("/follows"),
    ]);
    const likeCount = {}, likedByMe = new Set();
    (likes || []).forEach((l) => { likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1; if (String(l.user_key || "").toLowerCase() === meKey()) likedByMe.add(String(l.post_id)); });
    const commentCount = {};
    (comments || []).forEach((c) => { commentCount[c.post_id] = (commentCount[c.post_id] || 0) + 1; });
    const viewCount = (views && views.counts) || {};
    const following = new Set((follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === meKey()).map((f) => String(f.following || f.to_user || "").toLowerCase()));
    const withMedia = (posts || []).map((p) => ({ p, m: mediaOf(p) })).filter((x) => x.m);
    withMedia.sort((a, b) => ((b.m.kind === "video") - (a.m.kind === "video")) || (new Date(b.p.created_at) - new Date(a.p.created_at)));
    const box = $("#reels-box");
    if (!box) return;
    if (!withMedia.length) {
      box.innerHTML = `<div class="card empty"><span class="big">🎬</span>لا توجد فيديوهات بعد.<br/>انشر صورة أو فيديو من الرئيسية وستظهر هنا.<br/><br/><a class="btn sm" href="#/home">➕ نشر الآن</a></div>`;
      return;
    }
    box.innerHTML = `<div class="reels-feed tt" id="reels-feed">${withMedia.map(({ p, m }) => {
      const uname = String(p.username || p.user || "");
      const owner = personOf(uname);
      const liked = likedByMe.has(String(p.id));
      const media = m.kind === "video"
        ? `<video src="${esc(m.src)}" muted loop playsinline preload="metadata"></video>`
        : `<img class="rm" src="${esc(m.src)}" loading="lazy" />`;
      const canFollow = uname.toLowerCase() !== meKey() && !following.has(uname.toLowerCase());
      return `<div class="reel" data-reel="${esc(p.id)}">
        ${media}<div class="reel-prog"><i></i></div><div class=""shade"></div>
        <div class="reel-rail">
          <button class="rail-btn ${liked ? "liked" : ""}" data-rlike="${esc(p.id)}"><span class="ei">${liked ? "❤️" : "🤍"}</span><span data-rlikes-n>${likeCount[p.id] || 0}</span></button>
          <button class="rail-btn" data-ropen="${esc(p.id)}"><span class="ei">💬</span><span>${commentCount[p.id] || 0}</span></button>
          <button class="rail-btn" data-rshare="${esc(p.id)}"><span class="ei">✈️</span><span>مشاركة</span></button>
          <span class="rail-btn" style="cursor:default"><span class="ei" style="font-size:24px">👁️</span><span data-rviews-n>${viewCount[p.id] || 0}</span></span>
        </div>
        <div class="reel-cap">
          <div class="who">${avatarHTML({ ...owner, name: p.name || owner.name }, "sm", isGold(uname))}
            <a href="#/profile?u=${encodeURIComponent(uname)}" style="text-decoration:none;color:#fff">@${esc(uname)}</a> ${nameBadges(uname)}
            ${canFollow ? `<button class="btn sm" data-rfollow="${esc(uname)}" style="padding:4px 14px">متابعة</button>` : ""}</div>
          <p>${esc(((p.title ? p.title + " — " : "") + (p.body || p.text || "")).slice(0, 200))}</p>
        </div>
      </div>`;
    }).join("")}</div>`;
    // like / open / share / follow
    $$("[data-rlike]", box).forEach((b) => (b.onclick = async () => {
      const id = b.getAttribute("data-rlike");
      const on = !b.classList.contains("liked");
      b.classList.toggle("liked", on);
      b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
      $(".ei", b).textContent = on ? "❤️" : "🤍";
      const n = $("[data-rlikes-n]", b);
      n.textContent = String(Math.max(0, (parseInt(n.textContent, 10) || 0) + (on ? 1 : -1)));
      try {
        await apiPost("/likes", { post_id: id, user_key: meKey(), on });
        if (on) { const p = (posts || []).find((x) => String(x.id) === String(id)); if (p) notifyOwner(p, "like"); }
      } catch {}
    }));
    $$("[data-ropen]", box).forEach((b) => (b.onclick = () => { location.hash = "#/post/" + b.getAttribute("data-ropen"); }));
    $$("[data-rshare]", box).forEach((b) => (b.onclick = async () => {
      try { await navigator.clipboard.writeText(location.origin + location.pathname + "#/post/" + b.getAttribute("data-rshare")); toast("تم نسخ الرابط", "ok"); } catch {}
    }));
    $$("[data-rfollow]", box).forEach((b) => (b.onclick = async () => {
      try { await apiPost("/follows", { from_user: meKey(), to_user: b.getAttribute("data-rfollow"), on: true }); toast("تمت المتابعة", "ok"); viewReels(el); }
      catch { toast("تعذر المتابعة", "err"); }
    }));
    // autoplay visible videos + record views
    const vio = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        const v = $("video", en.target);
        const id = en.target.getAttribute("data-reel");
        if (en.isIntersecting && en.intersectionRatio >= 0.55) {
          if (v && localStorage.getItem("zivv.autoplay") !== "0") v.play().catch(() => {});
          try {
            const bar = en.target.querySelector(".reel-prog i");
            if (v && bar) v.ontimeupdate = () => { try { bar.style.width = (v.duration ? (v.currentTime / v.duration) * 100 : 0) + "%"; } catch {} };
            if (v && !v._dbl) {
              v._dbl = true;
              v.ondblclick = async () => {
                try {
                  await apiPost("/likes", { post_id: id, user_key: meKey(), on: true });
                  const heart = document.createElement("div");
                  heart.textContent = "❤️";
                  heart.className = "dbl-heart";
                  en.target.appendChild(heart);
                  setTimeout(() => heart.remove(), 900);
                  viewReels(el);
                } catch {}
              };
            }
          } catch {}
          if (id && !S.viewed.has(id)) {
            S.viewed.add(id);
            apiPost("/views", { post_id: id, user_key: meKey() }).then((out) => {
              const n = en.target.querySelector("[data-rviews-n]");
              if (n && out && typeof out.views === "number") n.textContent = String(out.views);
            }).catch(() => {});
          }
        } else if (v) v.pause();
      });
    }, { threshold: [0, 0.55, 1] });
    S.observers.push(vio);
    try {
      const feed = box.querySelector(".reels-feed.tt");
      if (feed) {
        feed.addEventListener("pointerdown", () => feed.classList.add("tapped"));
        feed.addEventListener("pointerup", () => setTimeout(() => feed.classList.remove("tapped"), 120));
      }
    } catch {}
    $$(".reel", box).forEach((r) => vio.observe(r));
  } catch {
    const b = $("#reels-box");
    if (b) b.innerHTML = `<div class="card empty">تعذر التحميل</div>`;
  }
}

/* ---------- chat ---------- */
async function viewChat(el, params) {
  const peer0 = (params.get("u") || "").toLowerCase();
  el.innerHTML = `<div class="wrap-wide"><div class="chat-layout" id="chat-layout">
    <div class="threads">
      <div class="threads-head brand"><img src="brand/logo-sm.png" alt="ZIVV" /><b>الدردشات</b><span style="flex:1"></span><button class="btn soft sm" id="chat-new">+ جديد</button></div>
      <div style="padding:10px 12px 0"><input class="input" id="chat-q" placeholder="🔍 بحث في المحادثات…" /></div>
      <div class="threads-list" id="chat-threads"></div>
    </div>
    <div class="convo" id="chat-convo"><div class="empty"><span class="big">💬</span><b>دردشة ZIVV</b><br/>اختر محادثة أو ابدأ واحدة جديدة.</div></div>
  </div></div>`;

  let all = [];
  let reacts = [];
  async function refreshThreads() {
    try {
      all = await apiGet("/messages");
      reacts = await apiGet("/reactions").catch(() => []);
      await loadPeople();
      const qEl = $("#chat-q");
      if (!qEl) return;
      const q = (qEl.value || "").toLowerCase();
      const mine = (all || []).filter((m) =>
        String(m.thread_user || "").toLowerCase() === meKey() ||
        String(m.from_user || m.from_key || "").toLowerCase() === meKey());
      const groups = new Map();
      mine.forEach((m) => {
        const from = String(m.from_user || m.from_key || "").toLowerCase();
        const th = String(m.thread_user || "").toLowerCase();
        if (th.startsWith("priv:")) return;
        const peer = th === meKey() ? from : th;
        if (!peer) return;
        if (!groups.has(peer)) groups.set(peer, []);
        groups.get(peer).push(m);
      });
      let peers = Array.from(groups.entries()).map(([peer, msgs]) => {
        msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const unread = msgs.filter((m) => String(m.thread_user || "").toLowerCase() === meKey() && String(m.from_user || m.from_key || "").toLowerCase() === peer && !m.read).length;
        return { peer, last: msgs[msgs.length - 1], unread };
      }).sort((a, b) => new Date((b.last || {}).created_at || 0) - new Date((a.last || {}).created_at || 0));
      if (q) {
        const extra = Array.from(S.people.values()).filter((u) => u.username !== meKey() && (u.name + " " + u.username).toLowerCase().includes(q) && !groups.has(u.username));
        extra.forEach((u) => peers.push({ peer: u.username, last: null, unread: 0 }));
      } else if (peer0 && !groups.has(peer0)) {
        peers.unshift({ peer: peer0, last: null, unread: 0 });
      }
      const box = $("#chat-threads");
      if (!box) return;
      box.innerHTML = peers.length ? peers.map(({ peer, last, unread }) => {
        const who = personOf(peer);
        const prev = !last ? "ابدأ المحادثة" : (last.kind === "image" ? "📷 صورة" : esc(String(last.body || "").slice(0, 40)));
        const lastMine = last && String(last.from_user || last.from_key || "").toLowerCase() === meKey();
        return `<div class="thread-row ${S.chatPeer === peer ? "active" : ""}" data-peer="${esc(peer)}">
          ${avatarHTML(who, "sm", isGold(peer))}<div class="who">
          <div class="t-top"><b>${esc(who.name)} ${nameBadges(peer)}</b><span class="t-time">${last ? esc(timeAgo(last.created_at)) : ""}</span></div>
          <div class="t-sub">${lastMine ? `<span class="t-ticks ${last.read ? "read" : ""}">${last.read ? "✓✓" : "✓"}</span>` : ""}<span class="prev">${prev}</span>${unread ? `<span class="t-unread">${unread > 99 ? "99+" : unread}</span>` : ""}</div>
          </div></div>`;
      }).join("") : `<div class="empty"><span class="big">📭</span>لا توجد محادثات.</div>`;
      $$("#chat-threads [data-peer]").forEach((r) => (r.onclick = () => openThread(r.getAttribute("data-peer"))));
      if (S.chatPeer) {
        paintConvo();
        apiPost("/messages-read", { thread_user: meKey(), peer: S.chatPeer }).catch(() => {});
      }
    } catch {}
  }
  function msgsWith(peer) {
    return (all || []).filter((m) => {
      const from = String(m.from_user || m.from_key || "").toLowerCase();
      const th = String(m.thread_user || "").toLowerCase();
      return (th === peer && from === meKey()) || (th === meKey() && from === peer);
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  function paintConvo() {
    const peer = S.chatPeer;
    if (!peer) return;
    const who = personOf(peer);
    const convo = $("#chat-convo");
    if (!convo) return;
    const msgs = msgsWith(peer);
    const sig = msgs.map((m) => m.id + (m.read ? "r" : "")).join(",") + "|" + reacts.length;
    if ($("#convo-body") && S.chatLast === sig && $("#convo-peer") && $("#convo-peer").dataset.u === peer) return;
    S.chatLast = sig;
    let lastDay = "";
    const msgsHtml = msgs.map((m) => {
      const mine = String(m.from_user || m.from_key || "").toLowerCase() === meKey();
      const img = m.image_url || m.image ? `<img src="${esc(m.image_url || m.image)}" alt="" loading="lazy" />` : "";
      const q = m.reply_to ? msgs.find((x) => String(x.id) === String(m.reply_to)) : null;
      const qname = q ? (String(q.from_user || q.from_key || "").toLowerCase() === meKey() ? "أنت" : (q.name || who.name)) : "";
      const rg = {};
      reacts.filter((r) => String(r.msg_id) === String(m.id)).forEach((r) => {
        rg[r.emoji] = rg[r.emoji] || { n: 0, mine: false };
        rg[r.emoji].n++;
        if (String(r.user_key || "").toLowerCase() === meKey()) rg[r.emoji].mine = true;
      });
      const chips = Object.keys(rg).length ? `<span class="react-row">${Object.keys(rg).map((e) => `<button type="button" class="react-chip ${rg[e].mine ? "mine" : ""}" data-react="${esc(m.id)}">${e} ${rg[e].n}</button>`).join("")}</span>` : "";
      const day = dayLabel(m.created_at);
      const chip = day !== lastDay ? `<div class="date-chip">${esc(day)}</div>` : "";
      lastDay = day;
      return chip + `<div class="msg ${mine ? "me" : "them"}"><div class="b">${q ? `<span class="quote">↩️ ${esc(qname)}: ${esc(String(q.body || (q.image_url || q.image ? "📷 صورة" : "")).slice(0, 80))}</span>` : ""}${img}${esc(m.body || "")}${chips}
        <span class="meta-row"><time>${esc(timeAgo(m.created_at))}</time>${mine ? `<span class="ticks ${m.read ? "read" : ""}">${m.read ? "✓✓" : "✓"}</span>` : ""}
        <span class="mini-actions"><button type="button" class="mini-btn" data-reply="${esc(m.id)}" title="رد">↩️</button><button type="button" class="mini-btn" data-react="${esc(m.id)}" title="ريأكشن">😊</button>${mine ? `<button type="button" class="mini-btn" data-delmsg="${esc(m.id)}" title="حذف">🗑️</button>` : ""}</span></span></div></div>`;
    }).join("");
    const lastAct = msgs.length ? msgs[msgs.length - 1].created_at : null;
    convo.innerHTML = `
      <div class="convo-head" id="convo-peer" data-u="${esc(peer)}">
        <button class="icon-btn back-btn" id="convo-back">→</button>
        ${avatarHTML(who, "sm", isGold(peer))}
        <a href="#/profile?u=${encodeURIComponent(peer)}" style="text-decoration:none"><b>${esc(who.name)} ${nameBadges(peer)}</b><br/><span class="presence">${lastAct ? "آخر نشاط " + esc(timeAgo(lastAct)) : "محادثة جديدة"}</span></a>
      </div>
      <div class="convo-body wa" id="convo-body">
        ${msgs.length ? msgsHtml : `<div class="empty"><span class="big">👋</span>ابدأ المحادثة مع ${esc(who.name)}</div>`}
      </div>
      <div class="reply-bar ${S.chatReply ? "show" : ""}" id="reply-bar"><span>↩️</span><span class="q">${S.chatReply ? esc(S.chatReply.body) : ""}</span><button type="button" id="reply-x">✕</button></div>
      <form class="convo-form wa" id="convo-form">
        <button class="icon-btn" type="button" id="convo-img" title="صورة">🖼️</button>
        <input class="input" id="convo-inp" placeholder="اكتب رسالة…" autocomplete="off" maxlength="1000" />
        <button class="btn" type="submit" title="إرسال">➤</button>
      </form>`;
    const cb = $("#convo-body");
    cb.scrollTop = cb.scrollHeight;
    $("#convo-back").onclick = () => { S.chatPeer = null; S.chatReply = null; $("#chat-layout").classList.remove("thread-open"); $("#chat-convo").innerHTML = `<div class="empty"><span class="big">💬</span>اختر محادثة.</div>`; refreshThreads(); };
    const rx = $("#reply-x");
    if (rx) rx.onclick = () => { S.chatReply = null; const rb = $("#reply-bar"); if (rb) rb.classList.remove("show"); };
    $$("[data-reply]", convo).forEach((b) => (b.onclick = () => {
      const m = msgs.find((x) => String(x.id) === b.getAttribute("data-reply"));
      if (!m) return;
      S.chatReply = { id: m.id, body: String(m.body || (m.image_url || m.image ? "📷 صورة" : "")).slice(0, 100) };
      const rb = $("#reply-bar");
      if (rb) { rb.classList.add("show"); $(".q", rb).textContent = S.chatReply.body; }
      $("#convo-inp").focus();
    }));
    $$("[data-react]", convo).forEach((b) => (b.onclick = () => openReactPicker(b.getAttribute("data-react"))));
    $$("[data-delmsg]", convo).forEach((b) => (b.onclick = async () => {
      if (!confirm("حذف هذه الرسالة؟")) return;
      try { await apiDel("/messages?id=" + encodeURIComponent(b.getAttribute("data-delmsg")) + "&user=" + encodeURIComponent(meKey())); S.chatLast = ""; await refreshThreads(); }
      catch { toast("تعذر الحذف", "err"); }
    }));
    $("#convo-form").onsubmit = async (e) => {
      e.preventDefault();
      const inp = $("#convo-inp");
      const v = inp.value.trim();
      if (!v) return;
      inp.value = "";
      try {
        await apiPost("/messages", { thread_user: peer, from_key: meKey(), from_user: meKey(), name: meName(), kind: "text", body: v, reply_to: (S.chatReply && S.chatReply.id) || null });
        S.chatReply = null; S.chatLast = "";
        await refreshThreads();
      } catch { toast("تعذر الإرسال", "err"); }
    };
    $("#convo-img").onclick = async () => {
      const f = await pickFile("image/*");
      if (!f) return;
      toast("جاري الرفع…");
      try {
        const url = await uploadImage(f);
        await apiPost("/messages", { thread_user: peer, from_key: meKey(), from_user: meKey(), name: meName(), kind: "image", body: "", image_url: url, reply_to: (S.chatReply && S.chatReply.id) || null });
        S.chatReply = null; S.chatLast = "";
        await refreshThreads();
      } catch { toast("تعذر الإرسال", "err"); }
    };
  }
  function openReactPicker(msgId) {
    openModal(`<h3>اختر ريأكشن</h3><div class="emoji-pick">${["❤️", "😂", "😮", "😢", "👍", "🔥"].map((e) => `<button type="button" data-em="${e}">${e}</button>`).join("")}</div>`);
    $$("#modal-root [data-em]").forEach((b) => (b.onclick = async () => {
      closeModal();
      try { await apiPost("/reactions", { msg_id: msgId, user_key: meKey(), emoji: b.getAttribute("data-em") }); S.chatLast = ""; await refreshThreads(); }
      catch { toast("تعذر الريأكشن", "err"); }
    }));
  }
  function openThread(peer) {
    S.chatPeer = String(peer).toLowerCase();
    S.chatLast = "";
    S.chatReply = null;
    const lay = $("#chat-layout");
    if (lay) lay.classList.add("thread-open");
    paintConvo();
    refreshThreads();
  }
  $("#chat-new").onclick = () => { const q = $("#chat-q"); if (q) q.focus(); toast("ابحث عن شخص واختره"); };
  $("#chat-q").oninput = refreshThreads;
  if (peer0) { S.chatPeer = peer0; const lay = $("#chat-layout"); if (lay) lay.classList.add("thread-open"); }
  await refreshThreads();
  later(async () => {
    try {
      const fresh = await apiGet("/messages");
      const sigAll = (fresh || []).length + "|" + ((fresh || []).slice(-1)[0] || {}).id;
      if (sigAll !== S.chatAllSig) { S.chatAllSig = sigAll; all = fresh; if (S.chatPeer) paintConvo(); refreshThreads(); }
    } catch {}
  }, 3000);
}
async function viewAI(el) {
  el.innerHTML = `<div class="wrap-wide">
    <div class="ai-gpt-head"><div class="gpt-brand"><span class="gpt-orb"></span><div><b>زيفي AI</b><span>مساعدك الذكي بالعربية</span></div></div></div>
    <div class="ai-usage" id="ai-usage"></div>
    <div class="ai-layout">
      <div class="ai-chats">
        <div class="threads-head">المحادثات <span style="flex:1"></span><button class="btn soft sm" id="ai-new">+ جديد</button></div>
        <div class="threads-list" id="ai-list"></div>
      </div>
      <div class="ai-main">
        <div class="ai-chips" id="ai-chips" style="display:none">
          <button class="ai-chip" data-chip="اكتب لي نكتة قصيرة 😄">😄 نكتة</button>
          <button class="ai-chip" data-chip="اشرح لي الذكاء الاصطناعي ببساطة">🤖 اشرح AI</button>
          <button class="ai-chip" data-chip="نصيحة لليوم ✨">✨ نصيحة</button>
          <button class="ai-chip" data-chip="ترجم للإنجليزية: مرحبا كيف حالك">🌍 ترجمة</button>
        </div>
        <div class="ai-msgs" id="ai-msgs"><div class="empty"><span class="big">✨</span>اختر محادثة أو ابدأ واحدة جديدة.</div></div>
        <form class="convo-form" id="ai-form" style="display:none">
          <input class="input" id="ai-inp" placeholder="اسأل زيفي…" autocomplete="off" maxlength="2000" />
          <button class="btn" type="submit">إرسال</button>
        </form>
      </div>
    </div>
  </div>`;

  async function refreshUsage() {
    try {
      const u = await apiGet("/ai-usage?user=" + encodeURIComponent(meKey()));
      const w = $("#ai-usage");
      if (w) w.innerHTML = `<span>📊 استهلاك اليوم:</span>
        <span class="pill">💬 <b>${u.chats_count || 0}</b> رسالة</span>
        <span class="pill">🔤 <b>${Number(u.tokens_used || 0).toLocaleString("en")}</b> توكن</span>`;
    } catch {}
  }
  async function refreshChats() {
    try {
      const chats = await apiGet("/ai-chats?user=" + encodeURIComponent(meKey()));
      const box = $("#ai-list");
      if (!box) return;
      box.innerHTML = (chats || []).length ? chats.map((c) =>
        `<div class="ai-chat-row ${S.aiChat === c.id ? "active" : ""}" data-chat="${esc(c.id)}">💬<div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || "دردشة")}</div><small>${esc(timeAgo(c.updated_at || c.created_at))}</small></div></div>`
      ).join("") : `<div class="empty"><span class="big">✨</span>لا توجد محادثات.</div>`;
      $$("#ai-list [data-chat]").forEach((r) => (r.onclick = () => {
        S.aiChat = r.getAttribute("data-chat");
        $("#ai-form").style.display = ""; $("#ai-chips").style.display = "";
        refreshChats(); openChat();
      }));
    } catch {}
  }
  async function openChat() {
    const id = S.aiChat;
    if (!id) return;
    const box = $("#ai-msgs");
    if (!box) return;
    box.innerHTML = `<p style="color:var(--muted)">جاري التحميل…</p>`;
    try {
      const msgs = await apiGet("/ai-messages?chat_id=" + encodeURIComponent(id));
      box.innerHTML = (msgs || []).filter((m) => m.role !== "system").map((m) =>
        `<div class="ai-msg gpt ${m.role === "user" ? "user" : "bot"}"><div class="b">${esc(m.content || "")}</div></div>`
      ).join("") || `<div class="empty"><span class="big">✨</span>ابدأ الكلام مع زيفي.</div>`;
      box.scrollTop = box.scrollHeight;
      bindAiCopy(box);
    } catch { box.innerHTML = `<p style="color:var(--red)">تعذر التحميل</p>`; }
  }
  function bindAiCopy(box) {
    $$(".ai-msg.bot .b", box).forEach((b) => {
      if ($("[data-copied]", b)) return;
      const btn = document.createElement("button");
      btn.className = "copy-btn"; btn.type = "button";
      btn.setAttribute("data-copied", "1"); btn.textContent = "📋 نسخ";
      btn.onclick = async (e) => {
        e.stopPropagation();
        const t = b.cloneNode(true);
        const c = $("[data-copied]", t); if (c) c.remove();
        try { await navigator.clipboard.writeText(t.textContent.trim()); toast("تم النسخ", "ok"); } catch {}
      };
      b.appendChild(document.createElement("br"));
      b.appendChild(btn);
    });
  }
  async function sendText(text) {
    const img = S.aiImage || "";
    if ((!text && !img) || !S.aiChat) return;
    const box = $("#ai-msgs");
    const inp = $("#ai-inp");
    inp.value = ""; inp.disabled = true;
    box.insertAdjacentHTML("beforeend", `<div class="ai-msg user"><div class="b">${img ? `<img src="${img}" style="max-width:180px;border-radius:10px;display:block;margin-bottom:6px" />` : ""}${esc(text || "ما هذا؟")}</div></div>`);
    box.insertAdjacentHTML("beforeend", `<div class="ai-msg bot" id="ai-typing"><div class="b typing"><span></span><span></span><span></span></div></div>`);
    box.scrollTop = box.scrollHeight;
    try {
      await apiPost("/ai-messages", { chat_id: S.aiChat, role: "user", content: (img ? "📷 [صورة] " : "") + (text || "ما هذا؟") });
      const history = await apiGet("/ai-messages?chat_id=" + encodeURIComponent(S.aiChat));
      const msgs = [{ role: "system", content: AI_SYS }]
        .concat((history || []).filter((m) => m.role !== "system").slice(-12).map((m) => ({ role: m.role, content: m.content })));
      if (img && msgs.length) msgs[msgs.length - 1].image = img;
      const out = await apiPost("/ai", { user: meKey(), messages: msgs });
      const reply = out.text || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content) || "عذراً، لم أفهم.";
      await apiPost("/ai-messages", { chat_id: S.aiChat, role: "assistant", content: reply });
      if ((history || []).filter((m) => m.role === "user").length <= 1) {
        await apiPost("/ai-chats", { id: S.aiChat, user_key: meKey(), title: text.slice(0, 40) }).catch(() => {});
      }
      const t = $("#ai-typing"); if (t) t.remove();
      box.insertAdjacentHTML("beforeend", `<div class="ai-msg bot"><div class="b">${esc(reply)}</div></div>`);
      box.scrollTop = box.scrollHeight;
      refreshChats(); refreshUsage();
    } catch {
      const t = $("#ai-typing"); if (t) t.remove();
      box.insertAdjacentHTML("beforeend", `<div class="ai-msg bot"><div class="b">⚠️ تعذر الاتصال بزيفي. حاول مجدداً.</div></div>`);
    } finally { inp.disabled = false; inp.focus(); }
  }
  $("#ai-new").onclick = async () => {
    try {
      const c = await apiPost("/ai-chats", { user_key: meKey(), title: "دردشة جديدة" });
      S.aiChat = c.id;
      $("#ai-form").style.display = ""; $("#ai-chips").style.display = "";
      await refreshChats(); await openChat();
      $("#ai-inp").focus();
    } catch { toast("تعذر الإنشاء", "err"); }
  };
  $("#ai-form").onsubmit = (e) => { e.preventDefault(); sendText($("#ai-inp").value.trim()); };
  $$("#ai-chips [data-chip]").forEach((c) => (c.onclick = () => sendText(c.getAttribute("data-chip"))));
  $("#ai-img").onclick = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    toast("جاري تجهيز الصورة…");
    try {
      S.aiImage = await compressImage(f, 768, 0.7);
      $("#ai-att-img").src = S.aiImage;
      $("#ai-attached").style.display = "flex";
      toast("تم — اكتب سؤالك عن الصورة", "ok");
    } catch { toast("تعذر قراءة الصورة", "err"); }
  };
  $("#ai-att-x").onclick = () => { S.aiImage = null; $("#ai-attached").style.display = "none"; };
  function agentConfirm(html, fn) {
    openModal(`<h3>🤖 تأكيد الوكيل</h3><div style="font-size:14px;line-height:1.9">${html}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="ag-ok" style="flex:1">تأكيد وتنفيذ</button><button class="btn ghost" id="ag-no" style="flex:1">إلغاء</button></div>`);
    $("#ag-ok").onclick = async () => { closeModal(); try { await fn(); } catch { toast("تعذر التنفيذ", "err"); } };
    $("#ag-no").onclick = closeModal;
  }
  async function runAgent() {
    const inp = $("#agent-inp");
    const cmd = (inp.value || "").trim();
    if (!cmd) return;
    let m = cmd.match(/^(ابحث|دور|search)\s+(عن\s+)?(.+)/i);
    if (m && m[3]) { inp.value = ""; location.hash = "#/explore?q=" + encodeURIComponent(m[3].trim()); return; }
    m = cmd.match(/تابع\s+@?([a-z0-9_.-]+)/i);
    if (m) {
      const u = m[1].toLowerCase();
      if (u === meKey()) { toast("لا يمكنك متابعة نفسك", "err"); return; }
      agentConfirm(`متابعة <b>@${esc(u)}</b>؟`, async () => {
        await apiPost("/follows", { from_user: meKey(), to_user: u, on: true });
        toast("تمت المتابعة ✅", "ok"); inp.value = "";
      });
      return;
    }
    m = cmd.match(/^(انشر|نزل)(\s+بوست)?\s*[:\-]?\s*([\s\S]+)/i);
    if (m && m[3] && m[3].trim().length > 1) {
      const btxt = m[3].trim();
      agentConfirm(`نشر هذا المنشور؟<div class="agent-preview">${esc(btxt)}</div>`, async () => {
        await apiPost("/posts", { username: meKey(), name: meName(), avatar: (personOf(meKey()) || {}).avatar || "", title: "", body: btxt, type: "text", tags: [], dests: ["home", "explore"], status: "ok" });
        toast("تم النشر ✅", "ok"); inp.value = ""; location.hash = "#/home";
      });
      return;
    }
    m = cmd.match(/(البايو|النبذة|السيرة).{0,12}(إلى|الى|:)\s*([\s\S]+)/i) || cmd.match(/^(بايو|نبذة)\s*[:\-]?\s*([\s\S]+)/i);
    if (m) {
      const bio = (m[3] || m[2] || "").trim();
      if (bio) {
        agentConfirm(`تغيير نبذتك إلى:<div class="agent-preview">${esc(bio)}</div>`, async () => {
          const who = personOf(meKey());
          await apiPost("/profiles", { email: ME.email, username: meKey(), name: who.name || meName(), avatar: who.avatar || "", bio, city: who.city || "" });
          toast("تم تحديث النبذة ✅", "ok"); inp.value = "";
        });
        return;
      }
    }
    m = cmd.match(/(ابعت|ابعت|ارسل|أرسل)(\s+رسالة)?\s+(لـ|ل|الى|إلى|@)?\s*([a-z0-9_.-]+)\s*[:\-]?\s*([\s\S]+)/i);
    if (m && m[5] && m[5].trim()) {
      const u = m[4].toLowerCase(), btxt = m[5].trim();
      agentConfirm(`إرسال رسالة إلى <b>@${esc(u)}</b>:<div class="agent-preview">${esc(btxt)}</div>`, async () => {
        await apiPost("/messages", { thread_user: u, from_key: meKey(), from_user: meKey(), name: meName(), kind: "text", body: btxt });
        toast("تم الإرسال ✅", "ok"); inp.value = "";
      });
      return;
    }
    toast("لم أفهم 🤔 — جرّب: انشر … / تابع @user / ابحث عن … / ابعت لـ@user: …", "err");
  }
  $("#agent-go").onclick = runAgent;
  $("#agent-inp").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); runAgent(); } };
  await refreshUsage();
  await refreshChats();
  if (S.aiChat) { $("#ai-form").style.display = ""; $("#ai-chips").style.display = ""; openChat(); }
}

/* ---------- notes ---------- */
async function viewNotes(el) {
  el.innerHTML = `<div class="wrap-narrow"><div class="card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><b style="font-size:16px">الإشعارات</b><span style="flex:1"></span>
    <button class="btn soft sm" id="notes-read">تعليم الكل كمقروء</button></div>
    <div class="ntabs" id="notes-tabs">
      <button class="ntab active" data-ntab="all">الكل</button>
      <button class="ntab" data-ntab="social">اجتماعي</button>
      <button class="ntab" data-ntab="messages">رسائل</button>
      <button class="ntab" data-ntab="system">نظام</button>
    </div>
    <div id="notes-list"><div class="skel"></div></div>
  </div></div>`;
  $("#notes-read").onclick = async () => {
    try { await apiPost("/notes-read", { dest: meKey() }); toast("تم", "ok"); viewNotes(el); updateBadge(); }
    catch { toast("تعذر التحديث", "err"); }
  };
  let all = [];
  const cat = (n) => {
    const t = String(n.type || "");
    if (["like", "comment", "follow", "friend", "mention", "tag"].includes(t)) return "social";
    if (["message", "call"].includes(t)) return "messages";
    return "system";
  };
  function paint(tab) {
    $$("#notes-tabs .ntab").forEach((t) => t.classList.toggle("active", t.getAttribute("data-ntab") === tab));
    const box = $("#notes-list");
    if (!box) return;
    const list = tab === "all" ? all : all.filter((n) => cat(n) === tab);
    box.innerHTML = list.length ? list.map((n) => {
      const unread = n.unread === 1 || n.unread === true || n.unread === "true";
      const who = personOf(n.from_user);
      const icon = n.type === "like" ? "❤️" : n.type === "comment" ? "💬" : n.type === "friend" ? "🤝" : n.type === "message" ? "✉️" : "📢";
      return `<div class="note">${unread ? `<span class="dot"></span>` : `<span style="width:8px;flex-shrink:0"></span>`}
        ${avatarHTML({ ...who, name: n.from_name || who.name }, "sm")}
        <div style="flex:1"><p><b>${esc(n.from_name || who.name || "")}</b> ${esc(n.body || n.title || "")} ${icon}</p>
        <time>${esc(timeAgo(n.created_at))}</time></div></div>`;
    }).join("") : `<div class="empty"><span class="big">🤍</span>لا توجد إشعارات هنا.</div>`;
  }
  $$("#notes-tabs .ntab").forEach((t) => (t.onclick = () => paint(t.getAttribute("data-ntab"))));
  try {
    all = await apiGet("/notes?dest=" + encodeURIComponent(meKey()));
    paint("all");
  } catch {
    const b = $("#notes-list");
    if (b) b.innerHTML = `<div class="empty">تعذر التحميل</div>`;
  }
}
async function updateBadge() {
  try {
    const notes = await apiGet("/notes?dest=" + encodeURIComponent(meKey()));
    const n = (notes || []).filter((x) => x.unread === 1 || x.unread === true || x.unread === "true").length;
    [["#tb-notes-bdg"], ["#drawer-notes-bdg"]].forEach(([sel]) => {
      const b = $(sel);
      if (b) { b.style.display = n ? "" : "none"; b.textContent = String(n); }
    });
  } catch {}
}

/* ---------- profile (IG) ---------- */
async function viewProfile(el, params) {
  const u = (params.get("u") || meKey()).toLowerCase();
  const isMe = u === meKey();
  el.innerHTML = `<div class="wrap-narrow"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    await Promise.all([loadPeople(), loadGold()]);
    const [posts, likes, follows, comments, views] = await Promise.all([
      apiGet("/posts?limit=300"), apiGet("/likes"), apiGet("/follows"), apiGet("/comments"), apiGet("/views"),
    ]);
    const who = personOf(u);
    const myPosts = (posts || []).filter((p) => String(p.username || p.user || "").toLowerCase() === u);
    const followers = (follows || []).filter((f) => String(f.following || f.to_user || "").toLowerCase() === u);
    const following = (follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === u);
    const amFollowing = followers.some((f) => String(f.follower || f.from_user || "").toLowerCase() === meKey());
    const likeCount = {}, likedByMe = new Set();
    (likes || []).forEach((l) => { likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1; if (String(l.user_key || "").toLowerCase() === meKey()) likedByMe.add(String(l.post_id)); });
    const commentCount = {};
    (comments || []).forEach((c) => { commentCount[c.post_id] = (commentCount[c.post_id] || 0) + 1; });
    const viewCount = (views && views.counts) || {};

    el.innerHTML = `<div class="wrap-narrow">
      <div class="ig-top">
        ${avatarHTML(who, "lg", isGold(u))}
        <div class="info">
          <h2>${esc(who.name || u)} ${nameBadges(u)}</h2>
          <div class="u">@${esc(u)}${who.city ? " · 📍 " + esc(who.city) : ""}</div>
        </div>
      </div>
      <div class="ig-counts">
        <div><b>${myPosts.length}</b><small>منشور</small></div>
        <div><b>${followers.length}</b><small>متابِع</small></div>
        <div><b>${following.length}</b><small>يتابع</small></div>
      </div>
      ${who.bio ? `<div class="ig-bio">${esc(who.bio)}</div>` : ""}
      <div class="ig-actions" style="margin-inline:0">
        ${isMe ? `<button class="btn ghost sm" id="prof-edit-btn" style="flex:1">✏️ تعديل الحساب</button>`
          : `${amFollowing ? `<button class="btn ghost sm" id="prof-follow" data-on="0" style="flex:1">إلغاء المتابعة</button>` : `<button class="btn sm" id="prof-follow" data-on="1" style="flex:1">متابعة</button>`}
             <a class="btn ghost sm" href="#/chat?u=${encodeURIComponent(u)}" style="flex:1">💬 مراسلة</a>`}
      </div>
      <div class="ptabs">
        <button class="ptab active" data-ptab="posts">▦ المنشورات</button>
        <button class="ptab" data-ptab="media">🎬 الوسائط</button>
      </div>
      <div id="prof-tab-body" style="margin-top:dia">🎬 الوسائط</button>
      </div>
      <div id="prof-tab-body" style="margin-top:10px"></div>
    </div>`;

    if (isMe) {
      $("#prof-edit-btn").onclick = () => {
        openModal(`<h3>✏️ تعديل الحساب</h3>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px" id="prof-av-row">${avatarHTML(who, "")}<button class="btn soft sm" type="button" id="prof-av-btn">تغيير الصورة</button></div>
          <div class="field"><label>الاسم</label><input class="input" id="pe-name" value="${esc(who.name || "")}" /></div>
          <div class="field"><label>نبذة</label><input class="input" id="pe-bio" value="${esc(who.bio || "")}" placeholder="نبذة عنك…" /></div>
          <div class="field"><label>المدينة</label><input class="input" id="pe-city" value="${esc(who.city || "")}" placeholder="القاهرة" /></div>
          <button class="btn block" id="pe-save">حفظ التعديلات</button>`);
        let newAv = who.avatar || "";
        $("#prof-av-btn").onclick = async () => {
          const f = await pickFile("image/*");
          if (!f) return;
          toast("جاري الرفع…");
          try { newAv = await uploadImage(f); $("#prof-av-row").firstElementChild.outerHTML = avatarHTML({ username: u, name: who.name, avatar: newAv }, ""); toast("تم", "ok"); }
          catch { toast("تعذر الرفع", "err"); }
        };
        $("#pe-save").onclick = async () => {
          try {
            await apiPost("/profiles", { email: ME.email, username: u, name: $("#pe-name").value.trim() || who.name, avatar: newAv, bio: $("#pe-bio").value.trim(), city: $("#pe-city").value.trim() });
            ME.name = $("#pe-name").value.trim() || ME.name;
            localStorage.setItem("zivv.session", JSON.stringify(ME));
            closeModal(); toast("تم الحفظ", "ok");
            S.drawerCache = null; viewProfile(el, params); paintBottomAvatar();
          } catch { toast("تعذر الحفظ", "err"); }
        };
      };
    } else {
      const fb = $("#prof-follow");
      if (fb) fb.onclick = async () => {
        try { await apiPost("/follows", { from_user: meKey(), to_user: u, on: fb.getAttribute("data-on") === "1" }); toast("تم", "ok"); viewProfile(el, params); }
        catch { toast("تعذر التنفيذ", "err"); }
      };
    }

    function paintTab(tab) {
      $$(".ptab", el).forEach((t) => t.classList.toggle("active", t.getAttribute("data-ptab") === tab));
      const box = $("#prof-tab-body");
      if (tab === "media") {
        const media = myPosts.filter((p) => mediaOf(p));
        box.innerHTML = media.length ? `<div class="media-grid">${media.map((p) => {
          const m = mediaOf(p);
          const inner = m.kind === "video" ? `<video src="${esc(m.src)}" preload="metadata" muted></video><span class="vflag">🎬</span>` : `<img src="${esc(m.src)}" loading="lazy" />`;
          return `<div class="media-cell" data-open="${esc(p.id)}">${inner}<div class="ov">❤️ ${likeCount[p.id] || 0}</div></div>`;
        }).join("")}</div>` : `<div class="card empty"><span class="big">🎬</span>لا توجد وسائط.</div>`;
      } else {
        box.innerHTML = myPosts.length ? myPosts.map((p) => postCard(p, { likes: likeCount[p.id] || 0, liked: likedByMe.has(String(p.id)), comments: commentCount[p.id] || 0, views: viewCount[p.id] || 0 })).join("")
          : `<div class="card empty"><span class="big">📸</span>لا توجد منشورات.</div>`;
        bindFeed(box, myPosts);
      }
      $$("[data-open]", box).forEach((c) => (c.onclick = () => { location.hash = "#/post/" + c.getAttribute("data-open"); }));
    }
    $$(".ptab", el).forEach((t) => (t.onclick = () => paintTab(t.getAttribute("data-ptab"))));
    paintTab("posts");
  } catch {
    el.innerHTML = `<div class="wrap-narrow"><div class="card empty">تعذر تحميل الحساب</div></div>`;
  }
}

function paintBottomAvatar() {
  const me = personOf(meKey());
  const b = $("#bn-avatar");
  if (b) {
    b.style.background = avatarColor(meKey());
    b.innerHTML = `${esc(meName().charAt(0))}${me.avatar ? `<img src="${esc(me.avatar)}" onerror="this.remove()" />` : ""}`;
  }
}

/* ---------- single post ---------- */
async function viewPost(el, params, extra) {
  const id = extra || "";
  el.innerHTML = `<div class="wrap-narrow"><div class="skel"></div></div>`;
  try {
    await Promise.all([loadPeople(), loadGold()]);
    const [posts, likes, comments, views] = await Promise.all([apiGet("/posts?limit=300"), apiGet("/likes"), apiGet("/comments"), apiGet("/views")]);
    const p = (posts || []).find((x) => String(x.id) === String(id));
    const box = el.firstElementChild;
    if (!p) { box.innerHTML = `<div class="card empty"><span class="big">🔍</span>المنشور غير موجود.<br/><br/><a class="btn sm" href="#/home">الرئيسية</a></div>`; return; }
    const likeList = (likes || []).filter((l) => String(l.post_id) === String(id));
    box.innerHTML = postCard(p, {
      likes: likeList.length,
      liked: likeList.some((l) => String(l.user_key || "").toLowerCase() === meKey()),
      comments: (comments || []).filter((c) => String(c.post_id) === String(id)).length,
      views: ((views && views.counts) || {})[id] || 0,
    });
    bindFeed(box, posts);
    toggleComments(id, posts);
  } catch {
    el.innerHTML = `<div class="wrap-narrow"><div class="card empty">تعذر التحميل</div></div>`;
  }
}

/* ---------- stats ---------- */
async function viewStats(el) {
  el.innerHTML = `<div class="wrap-wide"><div class="skel"></div><div class="skel"></div></div>`;
  function countUp(elm) {
    const target = parseInt(elm.getAttribute("data-v") || "0", 10) || 0;
    const t0 = performance.now(), dur = 900;
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur);
      elm.textContent = Number(Math.round(target * (1 - Math.pow(1 - k, 3)))).toLocaleString("en");
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  try {
    const [stats, posts, views] = await Promise.all([apiGet("/stats"), apiGet("/posts?limit=200"), apiGet("/views")]);
    const s = (stats && stats.stats) || {};
    const vc = (views && views.counts) || {};
    const cards = [
      ["👥", s.accounts || 0, "مستخدم"], ["📝", s.posts || 0, "منشور"],
      ["❤️", s.likes || 0, "إعجاب"], ["💬", s.comments || 0, "تعليق"],
      ["👁️", s.views || 0, "مشاهدة"], ["✉️", s.messages || 0, "رسالة"],
      ["🤝", s.follows || 0, "متابعة"], ["✨", s.ai_chats || 0, "محادثة ذكاء"],
      ["🔤", s.ai_messages || 0, "رسالة ذكاء"], ["🔔", s.notes || 0, "إشعار"],
      ["📖", s.stories || 0, "ستوري"], ["👑", s.gold_reqs || 0, "طلب جولد"],
    ];
    const ai = s.ai_usage_today || { chats: 0, tokens: 0 };
    const top = (posts || []).map((p) => ({ p, v: vc[p.id] || 0 })).sort((a, b) => b.v - a.v).slice(0, 8);
    el.innerHTML = `<div class="wrap-wide">
      <div class="card"><b>📊 أرقام حقيقية مباشرة من قاعدة البيانات</b>
        <div style="font-size:12px;color:var(--muted)">المحرك: ${esc((stats && stats.mode) || "")} · آخر تحديث: ${esc(timeAgo((stats && stats.timestamp) || Date.now()))}</div></div>
      <div class="stat-grid">${cards.map(([i, v, l]) => `<div class="stat-card"><div style="font-size:22px">${i}</div><div class="v" data-v="${v}">0</div><div class="l">${l}</div></div>`).join("")}</div>
      <div class="card"><b>✨ استهلاك الذكاء الاصطناعي اليوم</b>
        <div class="stat-grid" style="margin:10px 0 0">
          <div class="stat-card"><div class="v" data-v="${ai.chats}">0</div><div class="l">رسالة اليوم</div></div>
          <div class="stat-card"><div class="v" data-v="${ai.tokens}">0</div><div class="l">توكن اليوم</div></div>
        </div></div>
      <div class="card"><b>🔥 الأعلى مشاهدة</b>
        <div style="overflow-x:auto;margin-top:8px"><table class="table">
          <tr><th>المنشور</th><th>الكاتب</th><th>👁️</th></tr>
          ${top.map(({ p, v }) => `<tr><td><a href="#/post/${esc(p.id)}" style="text-decoration:none">${esc((p.title || p.body || p.text || "").slice(0, 60))}</a></td><td>@${esc(p.username || p.user || "")}</td><td><b>${v}</b></td></tr>`).join("") || `<tr><td colspan="3">لا توجد بيانات</td></tr>`}
        </table></div></div>
    </div>`;
    $$(".stat-card .v", el).forEach(countUp);
  } catch { el.innerHTML = `<div class="wrap-wide"><div class="card empty">تعذر التحميل</div></div>`; }
}

/* ---------- gold ---------- */
async function viewGold(el) {
  el.innerHTML = `<div class="wrap-narrow"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    const rows = await apiGet("/gold");
    const mine = (rows || []).filter((g) => String(g.username || "").toLowerCase() === meKey()).slice(-1)[0];
    const approved = mine && mine.status === "approved";
    if (approved) await loadGold(true);
    el.innerHTML = `<div class="wrap-narrow">
      <div class="gold-hero">
        <span class="crown">👑</span>
        <h2>ZIVV GOLD</h2>
        <p>تميّز بالشارة الذهبية ومزايا حصرية</p>
      </div>
      ${mine ? `<div class="card" style="text-align:center">
          <b>حالة اشتراكك:</b>
          <span class="status-pill ${mine.status}">${mine.status === "approved" ? "👑 مشترك ذهبي" : mine.status === "rejected" ? "مرفوض" : "قيد المراجعة ⏳"}</span>
          ${approved ? `<p style="color:var(--muted);font-size:13px;margin:8px 0 0">شارتك الذهبية تظهر الآن بجانب اسمك في كل مكان 🎉</p>` : ""}
        </div>` : ""}
      <div class="plans">
        <div class="plan">
          <h3>مجاني</h3><div class="price">0 ج.م / للأبد</div>
          <ul><li>نشر ومنشورات غير محدودة</li><li>دردشة وستوري وريلز</li><li>زيفي AI الأساسي</li></ul>
          <button class="btn ghost block" disabled>خطتك الحالية</button>
        </div>
        <div class="plan gold-plan">
          <span class="plan-tag">الأكثر تميزاً ⭐</span>
          <h3>👑 جولد</h3><div class="price">اشتراك مميز</div>
          <ul><li>شارة ذهبية بجانب اسمك</li><li>أولوية الظهور في الاستكشاف</li><li>دعم مباشر من الملك</li><li>مزايا حصرية قريباً</li></ul>
          ${approved ? `<button class="btn gold block" disabled>👑 أنت مشترك</button>`
            : mine ? `<button class="btn gold block" disabled>⏳ قيد المراجعة</button>`
            : `<button class="btn gold block" id="gold-sub">اشترك الآن 👑</button>`}
        </div>
      </div>
    </div>`;
    const sb = $("#gold-sub");
    if (sb) sb.onclick = () => {
      openModal(`<h3>👑 طلب اشتراك جولد</h3>
        <div class="field"><label>ليه عايز الجولد؟ (اختياري)</label><input class="input" id="gold-note" placeholder="اكتب سبباً…" /></div>
        <button class="btn gold block" id="gold-send">تأكيد الطلب</button>`);
      $("#gold-send").onclick = async () => {
        try {
          await apiPost("/gold", { username: meKey(), name: meName(), note: $("#gold-note").value.trim() });
          closeModal(); toast("تم إرسال طلبك للملك 👑", "ok"); viewGold(el);
        } catch { toast("تعذر الإرسال", "err"); }
      };
    };
  } catch { el.innerHTML = `<div class="wrap-narrow"><div class="card empty">تعذر التحميل</div></div>`; }
}

/* ---------- king (admin) ---------- */
function kingQS() {
  try {
    const t = sessionStorage.getItem("zivv.king") || "";
    if (t) return "token=" + encodeURIComponent(t);
  } catch {}
  return "by=" + encodeURIComponent(meKey());
}
function kingBody(extra) {
  let t = "";
  try { t = sessionStorage.getItem("zivv.king") || ""; } catch {}
  return Object.assign({ by: meKey() }, t ? { king_token: t } : {}, extra || {});
}
function kingAuthed() {
  if (isAdmin()) return true;
  try { return !!(sessionStorage.getItem("zivv.king") || ""); } catch { return false; }
}
async function viewKing(el) {
  if (!kingAuthed()) {
    el.innerHTML = `<div class="wrap-narrow"><div class="card king-login">
      <span class="big-lock">🛡️</span>
      <h3>دخول الملك</h3>
      <p style="color:var(--muted);font-size:13px">منطقة إدارية محمية — أدخل كلمة سر الملك<br/>(تُضبط من متغير KING_PASSWORD على السيرفر)</p>
      <div class="field"><input class="input" id="king-pass" type="password" placeholder="كلمة السر" /></div>
      <button class="btn block" id="king-go">دخول 🛡️</button>
    </div></div>`;
    $("#king-go").onclick = async () => {
      try {
        const out = await apiPost("/king-login", { password: $("#king-pass").value });
        try { sessionStorage.setItem("zivv.king", out.token); } catch {}
        toast("مرحباً أيها الملك 👑", "ok");
        viewKing(el);
      } catch (e) { toast((e && e.message) || "تعذر الدخول", "err"); }
    };
    return;
  }
  el.innerHTML = `<div class="wrap-wide"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    await loadPeople();
    const [stats, golds, reports, accounts, posts, mods, auditLog] = await Promise.all([
      apiGet("/stats"), apiGet("/gold"), apiGet("/reports"), apiGet("/accounts"),
      apiGet("/posts?limit=300"), apiGet("/mod-actions?" + kingQS()).catch(() => []), apiGet("/audit?" + kingQS()).catch(() => []),
    ]);
    const s = (stats && stats.stats) || {};
    const pend = (golds || []).filter((g) => g.status === "pending").length;
    const banMap = {};
    (mods || []).filter((m) => m.action === "ban_user" || m.action === "unban")
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .forEach((m) => { banMap[String(m.target_user || "").toLowerCase()] = m.action === "ban_user"; });
    const bans = Object.keys(banMap).filter((k) => banMap[k]).length;
    el.innerHTML = `<div class="wrap-wide">
      <div class="card"><div style="display:flex;align-items:center;gap:10px"><b style="font-size:17px">🛡️ صفحة الملك — لوحة الإدارة</b><span style="flex:1"></span>
        <button class="btn ghost sm" id="king-out">خروج الملك</button></div>
        <div style="font-size:12px;color:var(--muted)">تحكم كامل حقيقي + سجل تدقيق لكل إجراء</div></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="v">${s.accounts || 0}</div><div class="l">مستخدم</div></div>
        <div class="stat-card"><div class="v">${s.posts || 0}</div><div class="l">منشور</div></div>
        <div class="stat-card"><div class="v">${pend}</div><div class="l">جولد معلق</div></div>
        <div class="stat-card"><div class="v">${(reports || []).length}</div><div class="l">بلاغ</div></div>
        <div class="stat-card"><div class="v">${bans}</div><div class="l">محظور</div></div>
        <div class="stat-card"><div class="v">${(auditLog || []).length}</div><div class="l">سجل تدقيق</div></div>
      </div>
      <div class="ptabs" style="border:none;margin:0 0 10px;flex-wrap:wrap">
        <button class="ptab active" data-ktab="gold">👑 الجولد (${(golds || []).length})</button>
        <button class="ptab" data-ktab="reports">🚩 البلاغات (${(reports || []).length})</button>
        <button class="ptab" data-ktab="users">👥 المستخدمون (${(accounts || []).length})</button>
        <button class="ptab" data-ktab="content">📝 المحتوى</button>
        <button class="ptab" data-ktab="audit">📋 التدقيق (${(auditLog || []).length})</button>
      </div>
      <div class="card" id="king-body" style="padding:8px 14px"></div>
    </div>`;
    $("#king-out").onclick = () => { try { sessionStorage.removeItem("zivv.king"); } catch {} location.hash = "#/home"; };

    function paintK(tab) {
      $$(".ptab", el).forEach((t) => t.classList.toggle("active", t.getAttribute("data-ktab") === tab));
      const box = $("#king-body");
      if (tab === "gold") {
        box.innerHTML = (golds || []).length ? `<div style="overflow-x:auto"><table class="table">
          <tr><th>المستخدم</th><th>ملاحظة</th><th>الحالة</th><th>إجراء</th></tr>
          ${(golds || []).map((g) => `<tr>
            <td><b>@${esc(g.username)}</b><br/><small style="color:var(--muted)">${esc(g.name || "")}</small></td>
            <td>${esc(g.note || "—")}</td>
            <td><span class="status-pill ${g.status}">${g.status === "approved" ? "مقبول" : g.status === "rejected" ? "مرفوض" : "معلق"}</span></td>
            <td style="white-space:nowrap">
              ${g.status !== "approved" ? `<button class="btn sm" data-gok="${esc(g.id)}">قبول</button>` : ""}
              ${g.status !== "rejected" ? `<button class="btn danger sm" data-gno="${esc(g.id)}">رفض</button>` : ""}
            </td></tr>`).join("")}</table></div>`
          : `<div class="empty"><span class="big">👑</span>لا توجد طلبات.</div>`;
        $$("[data-gok]", box).forEach((b) => (b.onclick = () => goldAct(b.getAttribute("data-gok"), "approved")));
        $$("[data-gno]", box).forEach((b) => (b.onclick = () => goldAct(b.getAttribute("data-gno"), "rejected")));
      } else if (tab === "reports") {
        box.innerHTML = (reports || []).length ? `<div style="overflow-x:auto"><table class="table">
          <tr><th>المُبلغ</th><th>المستهدف</th><th>النوع</th><th>السبب</th><th>رابط</th></tr>
          ${(reports || []).map((r) => `<tr>
            <td><b>${esc(r.reporter_name || "")}</b><br/><small style="color:var(--muted)">${esc(r.reporter_email || "")}</small></td>
            <td>@${esc(r.target_user || "")}</td><td>${esc(r.type || "")}</td><td>${esc(r.note || "")}</td>
            <td>${r.post_id ? `<a href="#/post/${esc(r.post_id)}">فتح</a>` : "—"}</td></tr>`).join("")}</table></div>`
          : `<div class="empty"><span class="big">✅</span>لا توجد بلاغات.</div>`;
      } else if (tab === "users") {
        box.innerHTML = `<div style="overflow-x:auto"><table class="table">
          <tr><th>المستخدم</th><th>البريد</th><th>منشورات</th><th>الحالة</th><th>إجراء</th></tr>
          ${(accounts || []).map((a) => {
            const u = String(a.username || "").toLowerCase();
            const np = (posts || []).filter((p) => String(p.username || p.user || "").toLowerCase() === u).length;
            const banned = !!banMap[u];
            return `<tr><td><a href="#/profile?u=${encodeURIComponent(u)}" style="text-decoration:none"><b>@${esc(u)}</b></a><br/><small style="color:var(--muted)">${esc(a.name || "")}</small></td>
              <td><small>${esc(a.email || "")}</small></td><td><b>${np}</b></td>
              <td>${banned ? `<span class="ban-tag">محظور</span>` : `<span class="avail-tag">نشط</span>`}</td>
              <td>${banned ? `<button class="btn soft sm" data-unban="${esc(u)}">فك الحظر</button>` : `<button class="btn danger sm" data-ban="${esc(u)}">حظر</button>`}</td></tr>`;
          }).join("")}</table></div>`;
        $$("[data-ban]", box).forEach((b) => (b.onclick = () => {
          const u = b.getAttribute("data-ban");
          openModal(`<h3>⛔ حظر @${esc(u)}</h3>
            <div class="field"><label>السبب</label><input class="input" id="ban-reason" placeholder="مثال: محتوى مسيء" /></div>
            <button class="btn danger block" id="ban-go">تأكيد الحظر</button>`);
          $("#ban-go").onclick = async () => {
            try {
              await apiPost("/mod-actions", kingBody({ action: "ban_user", target_user: u, target_type: "user", reason: $("#ban-reason").value.trim() }));
              closeModal(); toast("تم الحظر ⛔", "ok"); viewKing(el);
            } catch { toast("تعذر التنفيذ", "err"); }
          };
        }));
        $$("[data-unban]", box).forEach((b) => (b.onclick = async () => {
          try { await apiPost("/mod-actions", kingBody({ action: "unban", target_user: b.getAttribute("data-unban"), target_type: "user" })); toast("تم فك الحظر ✅", "ok"); viewKing(el); }
          catch { toast("تعذر التنفيذ", "err"); }
        }));
      } else if (tab === "content") {
        const latest = (posts || []).slice(0, 30);
        box.innerHTML = `<div style="overflow-x:auto"><table class="table">
          <tr><th>المنشور</th><th>الكاتب</th><th>النوع</th><th>إجراء</th></tr>
          ${latest.map((p) => `<tr><td><a href="#/post/${esc(p.id)}" style="text-decoration:none">${esc((p.title || p.body || p.text || "").slice(0, 60))}</a></td>
            <td>@${esc(p.username || p.user || "")}</td><td>${esc(p.type || "text")}</td>
            <td><button class="btn danger sm" data-rmpost="${esc(p.id)}">إزالة</button></td></tr>`).join("") || `<tr><td colspan="4">لا يوجد محتوى</td></tr>`}
        </table></div>`;
        $$("[data-rmpost]", box).forEach((b) => (b.onclick = async () => {
          if (!confirm("إزالة هذا المنشور نهائياً؟")) return;
          try { await apiPost("/mod-actions", kingBody({ action: "remove_post", target_id: b.getAttribute("data-rmpost"), target_type: "post" })); toast("تمت الإزالة", "ok"); viewKing(el); }
          catch { toast("تعذر التنفيذ", "err"); }
        }));
      } else {
        box.innerHTML = (auditLog || []).length ? `<div style="overflow-x:auto"><table class="table">
          <tr><th>الوقت</th><th>المدير</th><th>الإجراء</th><th>المستهدف</th><th>النتيجة</th><th>ملاحظة</th></tr>
          ${(auditLog || []).map((a) => `<tr><td><small>${esc(timeAgo(a.created_at))}</small></td><td><b>${esc(a.admin || "")}</b></td>
            <td>${esc(a.action || "")}</td><td>${esc(a.target || "")}</td><td>${esc(a.result || "")}</td><td><small>${esc(a.note || "")}</small></td></tr>`).join("")}</table></div>`
          : `<div class="empty"><span class="big">📋</span>لا توجد سجلات بعد.</div>`;
      }
    }
    async function goldAct(id, action) {
      try {
        await apiPost("/gold", kingBody({ id, action }));
        toast(action === "approved" ? "تم القبول 👑" : "تم الرفض", "ok");
        viewKing(el);
      } catch { toast("تعذر التنفيذ", "err"); }
    }
    $$(".ptab", el).forEach((t) => (t.onclick = () => paintK(t.getAttribute("data-ktab"))));
    paintK("gold");
  } catch { el.innerHTML = `<div class="wrap-wide"><div class="card empty">تعذر التحميل</div></div>`; }
}
/* ---------- create hub ---------- */
function videoDuration(file) {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration || 0; URL.revokeObjectURL(v.src); res(d); };
    v.onerror = () => rej(new Error("تعذر قراءة الفيديو"));
    v.src = URL.createObjectURL(file);
  });
}
async function publishPost(payload, doneMsg, doneHash) {
  await apiPost("/posts", Object.assign({
    username: meKey(), name: meName(),
    avatar: (personOf(meKey()) || {}).avatar || "",
    tags: [], dests: ["home", "explore"], status: "ok",
  }, payload));
  toast(doneMsg || "تم النشر", "ok");
  location.hash = doneHash || "#/home";
}
function parseTags(str) {
  return String(str || "").split(/[,\n]/).map((t) => t.trim().replace(/^#+/, "")).filter(Boolean).slice(0, 10);
}

/* ---------- videos (YouTube style) ---------- */
async function viewVideos(el) {
  el.innerHTML = `<div class="wrap-wide"><div class="watch-head"><span class="yt-ico">▶</span><div><b>فيديو ZIVV</b><span>شاهد أحدث الفيديوهات</span></div></div><div id="vv-grid"><div class="skel"></div><div class="skel"></div></div></div>`;
  try {
    await Promise.all([loadPeople(), loadGold()]);
    const [posts, views] = await Promise.all([apiGet("/posts?limit=200"), apiGet("/views")]);
    const viewCount = (views && views.counts) || {};
    const vids = (posts || []).map((p) => ({ p, m: mediaOf(p) })).filter((x) => x.m && x.m.kind === "video")
      .sort((a, b) => new Date(b.p.created_at) - new Date(a.p.created_at));
    const grid = $("#vv-grid");
    if (!grid) return;
    if (!vids.length) { grid.innerHTML = `<div class="card empty"><span class="big">🎬</span>لا توجد فيديوهات بعد.</div>`; return; }
    grid.innerHTML = `<div class="watch-grid">${vids.map(({ p, m }) => {
      const uname = String(p.username || p.user || "");
      const owner = personOf(uname);
      return `<div class="watch-card" data-open="${esc(p.id)}">
        <div class="thumb"><video src="${esc(m.src)}" preload="metadata" muted playsinline></video><span class="play">▶</span></div>
        <div class="wmeta">${avatarHTML({ ...owner, name: p.name || owner.name }, "sm", isGold(uname))}
          <div><b>${esc(p.title || (p.body || p.text || "فيديو").slice(0, 60))}</b>
          <small>${esc(p.name || owner.name || "")} ${nameBadges(uname)} · 👁️ ${viewCount[p.id] || 0} · ${esc(timeAgo(p.created_at))}</small></div>
        </div></div>`;
    }).join("")}</div>`;
    $$("[data-open]", grid).forEach((c) => (c.onclick = () => { location.hash = "#/post/" + c.getAttribute("data-open"); }));
  } catch { const g = $("#vv-grid"); if (g) g.innerHTML = `<div class="card empty">تعذر التحميل</div>`; }
}

/* ---------- music (YT-Music style) ---------- */
async function viewMusic(el) {
  el.innerHTML = `<div class="wrap-wide"><div class="ym-hero"><span class="ym-ico">🎵</span><div><b>موسيقى ZIVV</b><span>كل المقاطع الصوتية في مكان واحد</span></div></div>
    <div class="ym-player" id="ym-player" style="display:none"><span class="ym-cover" id="ym-cover">🎵</span>
      <div style="flex:1;min-width:0"><b id="ym-title">—</b><br/><small id="ym-artist" style="color:var(--muted)"></small></div>
      <button class="icon-btn" id="ym-toggle">⏸️</button></div>
    <div id="ym-list"><div class="skel"></div><div class="skel"></div></div></div>`;
  const stopYm = () => { try { if (S.ymAudio) { S.ymAudio.pause(); S.ymAudio = null; } } catch {} };
  try {
    await Promise.all([loadPeople(), loadGold()]);
    const posts = await apiGet("/posts?limit=200");
    const songs = (posts || []).map((p) => ({ p, m: mediaOf(p) })).filter((x) => (x.m && x.m.kind === "audio") || x.p.type === "music");
    const list = $("#ym-list");
    if (!list) return;
    if (!songs.length) { list.innerHTML = `<div class="card empty"><span class="big">🎵</span>لا توجد مقاطع صوتية بعد.</div>`; return; }
    list.innerHTML = songs.map(({ p, m }) => {
      const src = (m && m.src) || p.audio_url || "";
      return `<div class="tt-songrow ym-row" data-song="${esc(src)}" data-title="${esc(p.title || "مقطع صوتي")}" data-artist="${esc(p.name || "")}">
        ${(m && m.cover) ? `<img class="cv" src="${esc(m.cover)}" />` : `<span class="cv">🎵</span>`}
        <div style="flex:1;min-width:0"><b style="font-size:14px">${esc(p.title || "مقطع صوتي")}</b><br/><small style="color:var(--muted)">${esc(p.name || "")}</small></div>
        <button class="icon-btn ym-play">▶</button></div>`;
    }).join("");
    const player = $("#ym-player");
    $$("[data-song]", list).forEach((row) => (row.onclick = () => {
      const src = row.getAttribute("data-song");
      if (!src) { toast("لا يوجد صوت", "err"); return; }
      stopYm();
      $$("[data-song]", list).forEach((r) => r.classList.remove("playing"));
      row.classList.add("playing");
      S.ymAudio = new Audio(src);
      S.ymAudio.play().catch(() => {});
      player.style.display = "";
      $("#ym-title").textContent = row.getAttribute("data-title") || "مقطع صوتي";
      $("#ym-artist").textContent = row.getAttribute("data-artist") || "";
      $("#ym-toggle").textContent = "⏸️";
      S.ymAudio.onended = () => { $("#ym-toggle").textContent = "▶"; };
    }));
    $("#ym-toggle").onclick = () => {
      if (!S.ymAudio) return;
      if (S.ymAudio.paused) { S.ymAudio.play().catch(() => {}); $("#ym-toggle").textContent = "⏸️"; }
      else { S.ymAudio.pause(); $("#ym-toggle").textContent = "▶"; }
    };
  } catch { const l = $("#ym-list"); if (l) l.innerHTML = `<div class="card empty">تعذر التحميل</div>`; }
}

async function viewCreate(el, params) {
  const tab0 = params.get("tab") || "";
  const HUB = [
    ["song", "🎵", "أغنية", "مقطع صوتي مع غلاف"],
    ["longvideo", "🎞️", "فيديو طويل", "بصورة مصغرة وعنوان"],
    ["textimage", "📝", "نص وصور", "منشور سريع"],
    ["shortvideo", "⚡", "فيديو قصير", "ريلز عمودي"],
    ["video5min", "🎬", "فيديو 5 دقائق", "5 دقائق كحد أقصى"],
    ["market", "🏪", "إعلان سوق", "بِع منتجك"],
  ];
  const TITLES = { song: "🎵 نشر أغنية", longvideo: "🎞️ فيديو طويل", textimage: "📝 نص وصور", shortvideo: "⚡ فيديو قصير", video5min: "🎬 فيديو حتى 5 دقائق", market: "🏪 إعلان في السوق" };

  function paintHub() {
    el.innerHTML = `<div class="wrap-narrow">
      <div class="card" style="text-align:center"><b style="font-size:17px">➕ مركز الإنشاء</b>
      <div style="font-size:12.5px;color:var(--muted)">اختار نوع المحتوى اللي عايز تنشره</div></div>
      <div class="create-grid">${HUB.map(([k, e, t, s]) =>
        `<button class="create-card" data-ctab="${k}"><span class="e">${e}</span><b>${t}</b><small>${s}</small></button>`).join("")}
      </div></div>`;
    $$("[data-ctab]", el).forEach((b) => (b.onclick = () => paintForm(b.getAttribute("data-ctab"))));
  }

  function shell(inner) {
    return `<div class="wrap-narrow"><div class="card create-form">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <button class="icon-btn" id="cf-back" style="width:36px;height:36px;font-size:19px">→</button>
        <b style="font-size:16px" id="cf-title"></b></div>
      <div id="cf-body">${inner}</div></div></div>`;
  }
  function dropHTML(id, label) {
    return `<div class="upload-drop" id="${id}">${label}</div>`;
  }
  async function bindDrop(id, accept, maxMB, onFile) {
    const d = document.getElementById(id);
    if (!d) return;
    d.onclick = async () => {
      const f = await pickFile(accept);
      if (!f) return;
      if (maxMB && f.size > maxMB * 1024 * 1024) { toast(`الملف أكبر من ${maxMB}MB`, "err"); return; }
      try { await onFile(f, d); } catch (e) { toast((e && e.message) || "تعذر الرفع", "err"); }
    };
  }
  function filled(d, label) { d.classList.add("filled"); d.innerHTML = "✅ " + esc(label); }

  function paintForm(kind) {
    if (kind === "song") {
      el.innerHTML = shell(`
        ${dropHTML("f-audio", "🎵 اختار ملف الصوت (MP3 — حتى 10MB)")}
        <div style="height:10px"></div>
        ${dropHTML("f-cover", "🖼️ صورة الغلاف (اختياري)")}
        <div style="height:10px"></div>
        <div class="field"><label>اسم الأغنية *</label><input class="input" id="f-name" placeholder="مثال: أغنية الصباح" /></div>
        <div class="field"><label>وصف (اختياري)</label><textarea class="textarea" id="f-desc" style="min-height:70px" placeholder="كلمات أو وصف…"></textarea></div>
        <button class="btn block" id="f-pub">نشر الأغنية 🎵</button>`);
      $("#cf-title").textContent = TITLES.song;
      let audio = "", cover = "";
      bindDrop("f-audio", "audio/*", 10, async (f, d) => { toast("جاري الرفع…"); audio = await uploadVideo(f); filled(d, f.name); });
      bindDrop("f-cover", "image/*", 10, async (f, d) => { toast("جاري الرفع…"); cover = await uploadImage(f); filled(d, f.name); });
      $("#f-pub").onclick = async () => {
        const name = $("#f-name").value.trim();
        if (!audio) { toast("اختار ملف الصوت أولاً", "err"); return; }
        if (!name) { toast("اكتب اسم الأغنية", "err"); return; }
        $("#f-pub").disabled = true;
        try { await publishPost({ title: name, body: $("#f-desc").value.trim(), type: "music", audio_url: audio, image_url: cover }, "تم نشر الأغنية 🎵"); }
        catch { toast("تعذر النشر", "err"); $("#f-pub").disabled = false; }
      };
    } else if (kind === "longvideo" || kind === "video5min") {
      const is5 = kind === "video5min";
      el.innerHTML = shell(`
        ${dropHTML("f-video", `🎬 اختار الفيديو (حتى 10MB${is5 ? " — بحد أقصى 5 دقائق" : ""})`)}
        <div style="height:10px"></div>
        ${dropHTML("f-thumb", "🖼️ صورة مصغرة (اختياري)")}
        <div style="height:10px"></div>
        <div class="field"><label>العنوان *</label><input class="input" id="f-title" placeholder="عنوان جذاب…" /></div>
        <div class="field"><label>الوصف</label><textarea class="textarea" id="f-desc" style="min-height:70px"></textarea></div>
        <div class="field"><label>هاشتاجات (افصل بفاصلة)</label><input class="input" id="f-tags" placeholder="رياضة, تعليم" /></div>
        <button class="btn block" id="f-pub">نشر الفيديو 🎬</button>`);
      $("#cf-title").textContent = TITLES[kind];
      let video = "", thumb = "";
      bindDrop("f-video", "video/*", 10, async (f, d) => {
        if (is5) { const dur = await videoDuration(f); if (dur > 305) { toast("الفيديو أطول من 5 دقائق", "err"); return; } }
        toast("جاري الرفع…"); video = await uploadVideo(f); filled(d, f.name);
      });
      bindDrop("f-thumb", "image/*", 10, async (f, d) => { toast("جاري الرفع…"); thumb = await uploadImage(f); filled(d, f.name); });
      $("#f-pub").onclick = async () => {
        const title = $("#f-title").value.trim();
        if (!video) { toast("اختار الفيديو أولاً", "err"); return; }
        if (!title) { toast("اكتب العنوان", "err"); return; }
        $("#f-pub").disabled = true;
        try { await publishPost({ title, body: $("#f-desc").value.trim(), type: "video", video_url: video, image_url: thumb, tags: parseTags($("#f-tags").value) }, "تم نشر الفيديو 🎬"); }
        catch { toast("تعذر النشر", "err"); $("#f-pub").disabled = false; }
      };
    } else if (kind === "textimage") {
      el.innerHTML = shell(`
        <div class="field"><label>اكتب منشورك *</label><textarea class="textarea" id="f-body" style="min-height:100px" placeholder="شارك فكرتك…"></textarea></div>
        ${dropHTML("f-img", "🖼️ إرفاق صورة (اختياري)")}
        <div style="height:10px"></div>
        <div class="field"><label>هاشتاجات (افصل بفاصلة)</label><input class="input" id="f-tags" placeholder="يوميات, تصوير" /></div>
        <button class="btn block" id="f-pub">نشر 📝</button>`);
      $("#cf-title").textContent = TITLES.textimage;
      let img = "";
      bindDrop("f-img", "image/*", 10, async (f, d) => { toast("جاري الرفع…"); img = await uploadImage(f); filled(d, f.name); });
      $("#f-pub").onclick = async () => {
        const body = $("#f-body").value.trim();
        if (!body && !img) { toast("اكتب شيئاً أو أرفق صورة", "err"); return; }
        $("#f-pub").disabled = true;
        try { await publishPost({ title: "", body, type: img ? "image" : "text", image_url: img, tags: parseTags($("#f-tags").value) }, "تم النشر 📝"); }
        catch { toast("تعذر النشر", "err"); $("#f-pub").disabled = false; }
      };
    } else if (kind === "shortvideo") {
      el.innerHTML = shell(`
        ${dropHTML("f-video", "⚡ اختار فيديو عمودي قصير (حتى 10MB)")}
        <div style="height:10px"></div>
        <div class="field"><label>التعليق</label><textarea class="textarea" id="f-cap" style="min-height:70px" placeholder="وصف الريلز…"></textarea></div>
        <div class="field"><label>هاشتاجات (افصل بفاصلة)</label><input class="input" id="f-tags" placeholder="ريلز, ترند" /></div>
        <button class="btn block" id="f-pub">نشر الريلز ⚡</button>`);
      $("#cf-title").textContent = TITLES.shortvideo;
      let video = "";
      bindDrop("f-video", "video/*", 10, async (f, d) => { toast("جاري الرفع…"); video = await uploadVideo(f); filled(d, f.name); });
      $("#f-pub").onclick = async () => {
        if (!video) { toast("اختار الفيديو أولاً", "err"); return; }
        $("#f-pub").disabled = true;
        try { await publishPost({ title: "", body: $("#f-cap").value.trim(), type: "video", video_url: video, tags: parseTags($("#f-tags").value) }, "تم نشر الريلز ⚡", "#/reels"); }
        catch { toast("تعذر النشر", "err"); $("#f-pub").disabled = false; }
      };
    } else if (kind === "market") {
      el.innerHTML = shell(`
        ${dropHTML("f-img", "📷 صورة المنتج *")}
        <div style="height:10px"></div>
        <div class="field"><label>اسم المنتج *</label><input class="input" id="f-name" placeholder="مثال: آيفون 13" /></div>
        <div class="create-form row2">
          <div class="field"><label>السعر (ج.م) *</label><input class="input" id="f-price" type="number" min="0" placeholder="0" /></div>
          <div class="field"><label>الحالة</label><select class="input" id="f-cond"><option>جديد</option><option>مستعمل — ممتاز</option><option>مستعمل — جيد</option></select></div>
        </div>
        <div class="create-form row2">
          <div class="field"><label>التصنيف</label><select class="input" id="f-cat"><option>إلكترونيات</option><option>ملابس</option><option>سيارات</option><option>عقارات</option><option>أثاث</option><option>أخرى</option></select></div>
          <div class="field"><label>رقم الهاتف</label><input class="input" id="f-phone" placeholder="01xxxxxxxxx" /></div>
        </div>
        <div class="field"><label>وصف المنتج</label><textarea class="textarea" id="f-desc" style="min-height:70px" placeholder="المواصفات وحالة المنتج…"></textarea></div>
        <button class="btn block" id="f-pub">نشر الإعلان 🏪</button>
        <p style="font-size:12px;color:var(--muted);text-align:center">السوق للإعلانات والتواصل فقط — البيع يتم مباشرة بينك وبين المشتري.</p>`);
      $("#cf-title").textContent = TITLES.market;
      let img = "";
      bindDrop("f-img", "image/*", 10, async (f, d) => { toast("جاري الرفع…"); img = await uploadImage(f); filled(d, f.name); });
      $("#f-pub").onclick = async () => {
        const title = $("#f-name").value.trim();
        const price = parseFloat($("#f-price").value) || 0;
        if (!title) { toast("اكتب اسم المنتج", "err"); return; }
        if (!img) { toast("أضف صورة المنتج", "err"); return; }
        $("#f-pub").disabled = true;
        try {
          await apiPost("/products", {
            title, price, cat: $("#f-cat").value,
            seller: meName(), seller_user: meKey(),
            phone: $("#f-phone").value.trim(),
            image_url: img, description: $("#f-desc").value.trim(),
            specs: [$("#f-cond").value],
          });
          toast("تم نشر إعلانك 🏪", "ok");
          location.hash = "#/store";
        } catch { toast("تعذر النشر", "err"); $("#f-pub").disabled = false; }
      };
    } else { paintHub(); return; }
    $("#cf-back").onclick = paintHub;
  }

  if (tab0 && TITLES[tab0]) paintForm(tab0);
  else paintHub();
}

/* ---------- store (marketplace) ---------- */
async function viewStore(el, params) {
  el.innerHTML = `<div class="wrap-wide">
    <div class="market-notice">🛍️ <b>سوق ZIVV للإعلانات والتواصل فقط</b> — البيع والشراء والدفع والاستلام يتم مباشرة بين البائع والمشتري، والمنصة لا تضمن أي صفقة.</div>
    <div class="search-bar">
      <input class="input" id="st-q" placeholder="🔍 ابحث في السوق…" value="${esc((params && params.get('q')) || '')}" />
      <a class="btn sm" href="#/create?tab=market" style="white-space:nowrap">+ بِع منتجك</a>
    </div>
    <div class="store-grid" id="st-grid"></div>
  </div>`;
  let all = [];
  async function load() {
    const g = $("#st-grid");
    if (!g) return;
    g.innerHTML = `<div class="skel"></div><div class="skel"></div>`;
    try {
      await loadPeople();
      all = await apiGet("/products");
      paint(($("#st-q") || {}).value || "");
    } catch { g.innerHTML = `<div class="card empty">تعذر التحميل</div>`; }
  }
  function paint(q) {
    const g = $("#st-grid");
    if (!g) return;
    const ql = String(q || "").trim().toLowerCase();
    const list = ql ? all.filter((p) => ((p.title || "") + " " + (p.description || "") + " " + (p.cat || "")).toLowerCase().includes(ql)) : all;
    g.innerHTML = list.length ? list.map((p) => {
      const cond = Array.isArray(p.specs) ? p.specs[0] : p.specs;
      const sold = /مباع|sold/i.test(String(cond || ""));
      return `<div class="product-card" data-pr="${esc(p.id)}">
        ${p.image_url ? `<img class="pimg" src="${esc(p.image_url)}" loading="lazy" />` : `<div class="pimg-ph">📦</div>`}
        <div class="pbody"><b>${esc(p.title || "")}</b>
        <span class="price">${esc(String(p.price == null ? 0 : p.price))} ج.م</span>
        <div class="seller">${sold ? `<span class="sold-tag">مباع</span>` : `<span class="avail-tag">متاح</span>`} · ${esc(p.seller || p.seller_user || "")}</div></div></div>`;
    }).join("") : `<div class="card empty"><span class="big">🛍️</span>لا توجد منتجات.<br/><br/><a class="btn sm" href="#/create?tab=market">+ أضف أول منتج</a></div>`;
    $$("[data-pr]", g).forEach((c) => (c.onclick = () => openProduct(all.find((x) => String(x.id) === c.getAttribute("data-pr")))));
  }
  function openProduct(p) {
    if (!p) return;
    const cond = Array.isArray(p.specs) ? p.specs[0] : (p.specs || "—");
    const su = String(p.seller_user || "").toLowerCase();
    const who = su ? personOf(su) : null;
    openModal(`
      ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:100%;border-radius:14px;max-height:300px;object-fit:cover" />` : ""}
      <h3 style="margin:10px 0 2px">${esc(p.title || "")}</h3>
      <div class="price" style="color:var(--green);font-weight:900;font-size:19px">${esc(String(p.price == null ? 0 : p.price))} ج.م</div>
      <div style="font-size:13px;color:var(--muted);margin:6px 0">${esc(p.cat || "")} · الحالة: ${esc(String(cond))}</div>
      ${p.description ? `<p style="font-size:14px;line-height:1.8">${esc(p.description)}</p>` : ""}
      <div class="user-row" style="border:none;padding:8px 0">
        ${avatarHTML(who || { username: su, name: p.seller }, "sm")}
        <div class="who"><b>${esc((who && who.name) || p.seller || "")}</b><span>البائع${su ? " · @" + esc(su) : ""}</span></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${su ? `<a class="btn sm" href="#/chat?u=${encodeURIComponent(su)}" onclick="closeModal()">💬 مراسلة البائع</a>` : ""}
        ${p.phone ? `<a class="btn soft sm" href="tel:${esc(p.phone)}">📞 ${esc(p.phone)}</a>` : ""}
        <button class="btn ghost sm" id="pr-rep">🚩 إبلاغ</button>
      </div>`);
    const rb = $("#pr-rep");
    if (rb) rb.onclick = async () => {
      try {
        await apiPost("/reports", { post_id: "", target_user: su || p.seller || "", type: "product", dest: "king", reporter_name: meName(), reporter_email: ME.email, note: "إبلاغ عن منتج: " + (p.title || p.id) });
        closeModal(); toast("تم إرسال البلاغ للإدارة", "ok");
      } catch { toast("تعذر الإرسال", "err"); }
    };
  }
  let deb = null;
  $("#st-q").oninput = (e) => { clearTimeout(deb); deb = setTimeout(() => paint(e.target.value), 300); };
  load();
}

/* ---------- private chat (locked) ---------- */
async function viewPrivate(el, params) {
  let st = { configured: false };
  try { st = await apiPost("/private-auth", { action: "status", user: meKey() }); } catch {}
  if (!(S.privUntil && Date.now() < S.privUntil)) {
    el.innerHTML = `<div class="wrap-narrow"><div class="card lock-screen">
      <span class="big-lock">🔒</span>
      <h3>الدردشة الخاصة</h3>
      <p style="color:var(--muted);font-size:13px">${st.configured ? "أدخل كلمة السر لفتح محادثاتك الخاصة" : "أنشئ كلمة سر لدردشتك الخاصة (تُحفظ مشفّرة على السيرفر ولا تُعرض أبداً)"}</p>
      <div class="field"><input class="input" id="pv-pass" type="password" placeholder="كلمة السر (4 أحرف على الأقل)" /></div>
      <button class="btn block" id="pv-go">${st.configured ? "فتح 🔓" : "إنشاء 🔐"}</button>
      <p style="font-size:11.5px;color:var(--muted)">قفل تلقائي بعد 60 ثانية • 5 محاولات خاطئة = حظر مؤقت 5 دقائق</p>
    </div></div>`;
    $("#pv-go").onclick = async () => {
      const pw = $("#pv-pass").value || "";
      if (pw.length < 4) { toast("كلمة السر قصيرة", "err"); return; }
      try {
        await apiPost("/private-auth", { action: st.configured ? "verify" : "set", user: meKey(), password: pw });
        S.privUntil = Date.now() + 60000;
        toast(st.configured ? "تم الفتح 🔓" : "تم الإنشاء 🔐", "ok");
        viewPrivate(el, params);
      } catch (e) { toast((e && e.message) || "تعذر الدخول", "err"); }
    };
    return;
  }

  const peer0 = (params.get("u") || "").toLowerCase();
  el.innerHTML = `<div class="wrap-wide">
    <div class="priv-banner">🔒 منطقة خاصة — تُقفل تلقائياً بعد 60 ثانية <button class="btn sm" id="pv-lock" style="margin-inline-start:8px;padding:2px 12px">قفل الآن</button></div>
    <div class="chat-layout" id="chat-layout">
      <div class="threads">
        <div class="wa-brand"><img class="wa-logo" src="brand/zivv.png" alt="ZIVV" /><div><b>الخاصة</b><span>مشفرة 🔒</span></div><span style="flex:1"></span><button class="btn soft sm" id="pv-new">+ جديد</button></div>
        <div style="padding:10px 12px 0"><input class="input" id="pv-q" placeholder="بحث…" /></div>
        <div class="threads-list wa" id="pv-threads"></div>
      </div>
      <div class="convo" id="pv-convo"><div class="empty"><span class="big">🔒</span>اختر محادثة خاصة.</div></div>
    </div></div>`;

  let all = [];
  const bump = () => { S.privUntil = Date.now() + 60000; };
  $("#pv-lock").onclick = () => { S.privUntil = 0; viewPrivate(el, params); };

  async function refresh() {
    try {
      all = await apiGet("/messages");
      await loadPeople();
      const qEl = $("#pv-q");
      if (!qEl) return;
      bump();
      const q = (qEl.value || "").toLowerCase();
      const mine = (all || []).filter((m) => String(m.thread_user || "").toLowerCase().startsWith("priv:") &&
        (String(m.thread_user || "").toLowerCase() === "priv:" + meKey() || String(m.from_user || m.from_key || "").toLowerCase() === meKey()));
      const groups = new Map();
      mine.forEach((m) => {
        const from = String(m.from_user || m.from_key || "").toLowerCase();
        const th = String(m.thread_user || "").toLowerCase();
        const peer = th === "priv:" + meKey() ? from : th.slice(5);
        if (!peer || !peer.startsWith && false) return;
        if (!peer) return;
        if (!groups.has(peer)) groups.set(peer, []);
        groups.get(peer).push(m);
      });
      let peers = Array.from(groups.entries()).map(([peer, msgs]) => {
        msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const unread = msgs.filter((m) => String(m.from_user || m.from_key || "").toLowerCase() !== meKey() && !m.read).length;
        return { peer, last: msgs[msgs.length - 1], unread };
      }).sort((a, b) => new Date((b.last || {}).created_at || 0) - new Date((a.last || {}).created_at || 0));
      if (q) {
        const extra = Array.from(S.people.values()).filter((u) => u.username !== meKey() && (u.name + " " + u.username).toLowerCase().includes(q) && !groups.has(u.username));
        extra.forEach((u) => peers.push({ peer: u.username, last: null }));
      } else if (peer0 && !groups.has(peer0)) peers.unshift({ peer: peer0, last: null });
      const box = $("#pv-threads");
      if (!box) return;
      box.innerHTML = peers.length ? peers.map(({ peer, last, unread }) => {
        const who = personOf(peer);
        return `<div class="thread-row ${S.privPeer === peer ? "active" : ""}" data-peer="${esc(peer)}">
          ${avatarHTML(who, "sm", isGold(peer))}<div class="who"><b>🔒 ${esc(who.name)}</b><span>${last ? esc(String(last.body || (last.image_url ? "📷 صورة" : "")).slice(0, 35)) : "ابدأ المحادثة"}</span></div>${last && String(last.from_user || last.from_key || "").toLowerCase() === meKey() ? `<span class="ticks ${last.read ? "read" : ""}">✓✓</span>` : ""}${unread ? `<span class="unread">${unread}</span>` : ""}</div>`;
      }).join("") : `<div class="empty"><span class="big">📭</span>لا توجد محادثات خاصة.</div>`;
      $$("#pv-threads [data-peer]").forEach((r) => (r.onclick = () => openThread(r.getAttribute("data-peer"))));
      if (S.privPeer) paintConvo();
    } catch {}
  }
  function msgsWith(peer) {
    return (all || []).filter((m) => {
      const from = String(m.from_user || m.from_key || "").toLowerCase();
      const th = String(m.thread_user || "").toLowerCase();
      return (th === "priv:" + peer && from === meKey()) || (th === "priv:" + meKey() && from === peer);
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  function paintConvo() {
    const peer = S.privPeer;
    if (!peer) return;
    const who = personOf(peer);
    const convo = $("#pv-convo");
    if (!convo) return;
    const msgs = msgsWith(peer);
    const sig = msgs.map((m) => m.id).join(",");
    if ($("#pv-body") && S.privLast === sig) return;
    S.privLast = sig;
    bump();
    apiPost("/messages-read", { thread_user: "priv:" + meKey(), peer }).catch(() => {});
    convo.innerHTML = `
      <div class="convo-head"><button class="icon-btn back-btn" id="pv-back">→</button>
        ${avatarHTML(who, "sm", isGold(peer))}
        <div><b>🔒 ${esc(who.name)}</b><br/><span style="font-size:12px;color:var(--muted)">@${esc(peer)}</span></div>
      </div>
      <div class="convo-body wa" id="pv-body">
        ${msgs.length ? msgs.map((m, ix, arr) => {
          let chip = "";
          try {
            const pm = arr[ix - 1] || {};
            const pd = new Date(typeof pm.created_at === "number" ? pm.created_at : String(pm.created_at || ""));
            const cd = new Date(typeof m.created_at === "number" ? m.created_at : String(m.created_at || ""));
            if (ix === 0 || (pd && cd && !isNaN(cd.getTime()) && pd.toDateString() !== cd.toDateString())) chip = `<div class="date-chip">${esc(dayLabel(m.created_at))}</div>`;
          } catch { if (ix === 0) chip = `<div class="date-chip">${esc(dayLabel(m.created_at))}</div>`; }
          const mine = String(m.from_user || m.from_key || "").toLowerCase() === meKey();
          const img = m.image_url || m.image ? `<img src="${esc(m.image_url || m.image)}" alt="" loading="lazy" />` : "";
          const q = m.reply_to ? msgs.find((x) => String(x.id) === String(m.reply_to)) : null;
          return `${chip}<div class="msg ${mine ? "me" : "them"}"><div class="b">${q ? `<span class="quote">↩️ ${esc(String(q.body || "📷").slice(0, 60))}</span>` : ""}${img}${esc(m.body || "")}
          <span class="meta-row"><time>${esc(timeAgo(m.created_at))}</time>${mine ? `<span class="ticks ${m.read ? "read" : ""}">${m.read ? "✓✓" : "✓"}</span>` : ""}
          <span class="mini-actions"><button type="button" class="mini-btn" data-preply="${esc(m.id)}">↩️</button>${mine ? `<button type="button" class="mini-btn" data-pdel="${esc(m.id)}">🗑️</button>` : ""}</span></span></div></div>`;
        }).join("") : `<div class="empty"><span class="big">👋</span>ابدأ الكلام الخاص مع ${esc(who.name)}</div>`}
      </div>
      <div class="reply-bar ${S.privReply ? "show" : ""}" id="pv-replybar"><span>↩️</span><span class="q">${S.privReply ? esc(S.privReply.body) : ""}</span><button type="button" id="pv-rx">✕</button></div>
      <form class="convo-form wa" id="pv-form">
        <button class="icon-btn" type="button" id="pv-img">🖼️</button>
        <input class="input" id="pv-inp" placeholder="رسالة خاصة…" autocomplete="off" maxlength="1000" />
        <button class="wa-send" type="submit">➤</button>
      </form>`;
    $("#pv-body").scrollTop = $("#pv-body").scrollHeight;
    $("#pv-back").onclick = () => { S.privPeer = null; $("#chat-layout").classList.remove("thread-open"); $("#pv-convo").innerHTML = `<div class="empty"><span class="big">🔒</span>اختر محادثة.</div>`; refresh(); };
    $("#pv-rx").onclick = () => { S.privReply = null; $("#pv-replybar").classList.remove("show"); };
    $$("[data-preply]", convo).forEach((b) => (b.onclick = () => {
      const m = msgs.find((x) => String(x.id) === b.getAttribute("data-preply"));
      if (!m) return;
      S.privReply = { id: m.id, body: String(m.body || "📷 صورة").slice(0, 100) };
      $("#pv-replybar").classList.add("show");
      $("#pv-replybar .q").textContent = S.privReply.body;
      $("#pv-inp").focus();
    }));
    $$("[data-pdel]", convo).forEach((b) => (b.onclick = async () => {
      if (!confirm("حذف الرسالة؟")) return;
      try { await apiDel("/messages?id=" + encodeURIComponent(b.getAttribute("data-pdel")) + "&user=" + encodeURIComponent(meKey())); S.privLast = ""; refresh(); }
      catch { toast("تعذر الحذف", "err"); }
    }));
    $("#pv-form").onsubmit = async (e) => {
      e.preventDefault();
      const v = $("#pv-inp").value.trim();
      if (!v) return;
      $("#pv-inp").value = "";
      try {
        await apiPost("/messages", { thread_user: "priv:" + peer, from_key: meKey(), from_user: meKey(), name: meName(), kind: "text", body: v, reply_to: (S.privReply && S.privReply.id) || null });
        S.privReply = null; S.privLast = "";
        refresh();
      } catch { toast("تعذر الإرسال", "err"); }
    };
    $("#pv-img").onclick = async () => {
      const f = await pickFile("image/*");
      if (!f) return;
      toast("جاري الرفع…");
      try {
        const url = await uploadImage(f);
        await apiPost("/messages", { thread_user: "priv:" + peer, from_key: meKey(), from_user: meKey(), name: meName(), kind: "image", body: "", image_url: url });
        S.privLast = "";
        refresh();
      } catch { toast("تعذر الإرسال", "err"); }
    };
  }
  function openThread(peer) {
    S.privPeer = String(peer).toLowerCase();
    S.privLast = ""; S.privReply = null;
    const lay = $("#chat-layout");
    if (lay) lay.classList.add("thread-open");
    paintConvo();
    refresh();
  }
  $("#pv-new").onclick = () => { const q = $("#pv-q"); if (q) q.focus(); toast("ابحث عن شخص واختره"); };
  $("#pv-q").oninput = refresh;
  if (peer0) { S.privPeer = peer0; const lay = $("#chat-layout"); if (lay) lay.classList.add("thread-open"); }
  await refresh();
  later(() => { if (!(S.privUntil && Date.now() < S.privUntil)) { S.privUntil = 0; S.privPeer = null; viewPrivate(el, params); } }, 5000);
  later(async () => {
    try {
      const fresh = await apiGet("/messages");
      const sigAll = (fresh || []).length + "|" + ((fresh || []).slice(-1)[0] || {}).id;
      if (sigAll !== S.privSig) { S.privSig = sigAll; all = fresh; refresh(); }
    } catch {}
  }, 3000);
}

/* ---------- friends ---------- */
async function viewFriends(el) {
  el.innerHTML = `<div class="wrap-narrow"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    await loadPeople();
    const [reqs, follows] = await Promise.all([apiGet("/friends"), apiGet("/follows")]);
    const me = meKey();
    const incoming = (reqs || []).filter((r) => String(r.to_user || "").toLowerCase() === me && r.status === "pending");
    const outgoing = (reqs || []).filter((r) => String(r.from_user || "").toLowerCase() === me && r.status === "pending");
    const friendSet = new Set();
    (reqs || []).filter((r) => r.status === "accepted").forEach((r) => {
      const a = String(r.from_user || "").toLowerCase(), b = String(r.to_user || "").toLowerCase();
      if (a === me) friendSet.add(b);
      if (b === me) friendSet.add(a);
    });
    const pendSet = new Set([
      ...incoming.map((r) => String(r.from_user || "").toLowerCase()),
      ...outgoing.map((r) => String(r.to_user || "").toLowerCase()),
    ]);
    const myFollowing = new Set((follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === me).map((f) => String(f.following || f.to_user || "").toLowerCase()));
    const cands = Array.from(S.people.values())
      .filter((u) => u.username !== me && !friendSet.has(u.username) && !pendSet.has(u.username))
      .map((u) => {
        const uF = new Set((follows || []).filter((f) => String(f.following || f.to_user || "").toLowerCase() === u.username).map((f) => String(f.follower || f.from_user || "").toLowerCase()));
        let mutual = 0;
        myFollowing.forEach((x) => { if (uF.has(x)) mutual++; });
        return { u, mutual };
      })
      .sort((a, b) => b.mutual - a.mutual)
      .slice(0, 10);
    const row = (u, extra, actions) => `<div class="user-row">${avatarHTML(u, "sm", isGold(u.username))}
      <div class="who"><b><a href="#/profile?u=${encodeURIComponent(u.username)}">${esc(u.name)}</a> ${nameBadges(u.username)}</b><span>${extra}</span></div>
      <div class="fr-actions">${actions}</div></div>`;

    el.innerHTML = `<div class="wrap-narrow"><div class="card" style="padding:8px 14px">
      <b style="font-size:16px">👥 الأصدقاء (${friendSet.size})</b>
      ${friendSet.size ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${Array.from(friendSet).slice(0, 12).map((f) => {
        const w = personOf(f);
        return `<a href="#/profile?u=${encodeURIComponent(f)}" style="text-decoration:none;text-align:center">${avatarHTML(w, "sm")}<div style="font-size:11px;color:var(--text)">${esc((w.name || f).split(" ")[0])}</div></a>`;
      }).join("")}</div>` : `<p style="color:var(--muted);font-size:13px">لا أصدقاء بعد — اقبل طلبات أو أضف أشخاصاً.</p>`}
      <div class="fr-section">📥 طلبات واردة (${incoming.length})</div>
      ${incoming.length ? incoming.map((r) => {
        const w = personOf(r.from_user);
        return row({ ...w, name: r.from_name || w.name }, `@${esc(r.from_user)} · ${esc(timeAgo(r.created_at))}`,
          `<button class="btn sm" data-frok="${esc(r.id)}">تأكيد</button><button class="btn ghost sm" data-frno="${esc(r.id)}">حذف</button>`);
      }).join("") : `<p style="color:var(--muted);font-size:13px">لا توجد طلبات واردة.</p>`}
      <div class="fr-section">📤 طلبات مرسلة (${outgoing.length})</div>
      ${outgoing.length ? outgoing.map((r) => {
        const w = personOf(r.to_user);
        return row({ ...w, name: r.to_name || w.name }, `@${esc(r.to_user)} · ${esc(timeAgo(r.created_at))}`,
          `<button class="btn ghost sm" data-frcancel="${esc(r.id)}">إلغاء</button>`);
      }).join("") : `<p style="color:var(--muted);font-size:13px">لا توجد طلبات مرسلة.</p>`}
      <div class="fr-section">✨ مقترحون لك</div>
      ${cands.length ? cands.map(({ u, mutual }) => row(u, `@${esc(u.username)}${mutual ? ` · 👥 ${mutual} مشترك` : ""}`,
        `<button class="btn soft sm" data-frsend="${esc(u.username)}" data-name="${esc(u.name)}">+ إضافة</button>`)).join("") : `<p style="color:var(--muted);font-size:13px">لا اقتراحات حالياً.</p>`}
    </div></div>`;

    $$("[data-frok]", el).forEach((b) => (b.onclick = async () => {
      try {
        await apiPost("/friends", { id: b.getAttribute("data-frok"), action: "accepted" });
        const r = (reqs || []).find((x) => String(x.id) === b.getAttribute("data-frok"));
        if (r) await apiPost("/notes", { dest: String(r.from_user || "").toLowerCase(), type: "friend", title: "صداقة جديدة", body: `${meName()} قبل طلب صداقتك`, from_user: meKey(), from_name: meName(), unread: true }).catch(() => {});
        toast("تمت الإضافة 🤝", "ok"); viewFriends(el);
      } catch { toast("تعذر التنفيذ", "err"); }
    }));
    $$("[data-frno]", el).forEach((b) => (b.onclick = async () => {
      try { await apiPost("/friends", { id: b.getAttribute("data-frno"), action: "declined" }); toast("تم الحذف", "ok"); viewFriends(el); }
      catch { toast("تعذر التنفيذ", "err"); }
    }));
    $$("[data-frcancel]", el).forEach((b) => (b.onclick = async () => {
      try { await apiPost("/friends", { id: b.getAttribute("data-frcancel"), action: "cancelled" }); toast("تم الإلغاء", "ok"); viewFriends(el); }
      catch { toast("تعذر التنفيذ", "err"); }
    }));
    $$("[data-frsend]", el).forEach((b) => (b.onclick = async () => {
      try {
        await apiPost("/friends", { from_user: meKey(), from_name: meName(), to_user: b.getAttribute("data-frsend"), to_name: b.getAttribute("data-name") });
        await apiPost("/notes", { dest: b.getAttribute("data-frsend"), type: "friend", title: "طلب صداقة", body: `${meName()} أرسل لك طلب صداقة`, from_user: meKey(), from_name: meName(), unread: true }).catch(() => {});
        toast("تم إرسال الطلب", "ok"); viewFriends(el);
      } catch { toast("تعذر الإرسال", "err"); }
    }));
  } catch { el.innerHTML = `<div class="wrap-narrow"><div class="card empty">تعذر التحميل</div></div>`; }
}

/* ---------- settings ---------- */
async function viewSettings(el) {
  const me = personOf(meKey());
  const autoplay = localStorage.getItem("zivv.autoplay") !== "0";
  const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  el.innerHTML = `<div class="wrap-narrow">
    <div class="card set-card"><h3>👤 الحساب</h3>
      <div class="user-row" style="border:none">${avatarHTML({ ...me, name: meName() }, "", isGold(meKey()))}
        <div class="who"><b>${esc(meName())} ${nameBadges(meKey())}</b><span>@${esc(meKey())} · ${esc(ME.email || "")}</span></div></div>
      <div class="set-row"><div class="grow"><b>تغيير كلمة السر</b></div></div>
      <div class="field"><input class="input" id="pw-old" type="password" placeholder="كلمة السر الحالية" /></div>
      <div class="field"><input class="input" id="pw-new" type="password" placeholder="الجديدة (6 أحرف على الأقل)" /></div>
      <button class="btn soft block" id="pw-save">حفظ كلمة السر</button>
    </div>
    <div class="card set-card"><h3>🎨 المظهر</h3>
      <div class="set-row"><div class="grow"><b>الوضع الليلي</b><small>أسود إنستجرام / أبيض نهاري</small></div>
        <label class="switch"><input type="checkbox" id="set-theme" ${theme === "dark" ? "checked" : ""} /><span class="sl"></span></label></div>
      <div class="set-row"><div class="grow"><b>التشغيل التلقائي للريلز</b><small>تشغيل الفيديو عند ظهوره</small></div>
        <label class="switch"><input type="checkbox" id="set-autoplay" ${autoplay ? "checked" : ""} /><span class="sl"></span></label></div>
    </div>
    <div class="card set-card"><h3>🔔 الإشعارات</h3>
      <div class="set-row"><div class="grow"><b>مركز الإشعارات</b><small>كل تنبيهاتك في مكان واحد</small></div><a class="btn soft sm" href="#/notes">فتح</a></div>
      <div class="set-row"><div class="grow"><b>تعليم الكل كمقروء</b></div><button class="btn ghost sm" id="set-readall">تنفيذ</button></div>
    </div>
    <div class="card set-card"><h3>🔒 الخصوصية والأمان</h3>
      <div class="set-row"><div class="grow"><b>الدردشة الخاصة</b><small>محادثات مقفولة بكلمة سر</small></div><a class="btn soft sm" href="#/private">فتح</a></div>
      <div class="set-row"><div class="grow"><b>جلسة الدخول</b><small>${esc(ME.email || "")} · هذا الجهاز</small></div><button class="btn ghost sm" id="set-logout">خروج</button></div>
    </div>
    <div class="card set-card"><h3>❓ المساعدة</h3>
      <div class="faq-item"><b>كيف أنشر فيديو؟</b><p>من زر + في الأسفل اختر نوع الفيديو، ثم ارفع الملف (حتى 10MB) وانشر.</p></div>
      <div class="faq-item"><b>كيف أحصل على شارة الجولد؟</b><p>من صفحة ZIVV Gold اطلب الاشتراك، وبعد موافقة الإدارة تظهر شارتك الذهبية.</p></div>
      <div class="faq-item"><b>كيف أبيع في السوق؟</b><p>من زر + اختر "إعلان سوق"، أضف الصور والسعر ورقمك، وسيتواصل معك المشترون مباشرة.</p></div>
      <div class="faq-item"><b>نسيت كلمة سر الدردشة الخاصة؟</b><p>تواصل مع الإدارة من زر "الإبلاغ عن مشكلة" وسيتم التحقق ومساعدتك.</p></div>
      <button class="btn ghost block" id="set-report" style="margin-top:8px">🚩 الإبلاغ عن مشكلة</button>
    </div>
    <p style="text-align:center;color:var(--muted);font-size:12px">ZIVV v3.0 • صُنع بحب في مصر 🇪🇬</p>
  </div>`;

  $("#pw-save").onclick = async () => {
    const o = $("#pw-old").value, n = $("#pw-new").value;
    if (!o || n.length < 6) { toast("تحقق من الحقول (الجديدة 6+ أحرف)", "err"); return; }
    try { await apiPost("/auth/change", { email: ME.email, old_password: o, new_password: n }); toast("تم تغيير كلمة السر ✅", "ok"); $("#pw-old").value = ""; $("#pw-new").value = ""; }
    catch (e) { toast((e && e.message) || "تعذر التغيير", "err"); }
  };
  $("#set-theme").onchange = (e) => toggleTheme();
  $("#set-autoplay").onchange = (e) => { localStorage.setItem("zivv.autoplay", e.target.checked ? "1" : "0"); toast("تم الحفظ", "ok"); };
  $("#set-readall").onclick = async () => {
    try { await apiPost("/notes-read", { dest: meKey() }); updateBadge(); toast("تم", "ok"); } catch { toast("تعذر التنفيذ", "err"); }
  };
  $("#set-logout").onclick = () => {
    if (!confirm("تسجيل الخروج من هذا الجهاز؟")) return;
    localStorage.removeItem("zivv.session");
    location.replace("index.html");
  };
  $("#set-report").onclick = () => {
    openModal(`<h3>🚩 الإبلاغ عن مشكلة</h3>
      <div class="field"><textarea class="textarea" id="fb-note" style="min-height:90px" placeholder="اشرح المشكلة بالتفصيل…"></textarea></div>
      <button class="btn block" id="fb-send">إرسال للإدارة</button>`);
    $("#fb-send").onclick = async () => {
      const v = $("#fb-note").value.trim();
      if (!v) { toast("اكتب المشكلة", "err"); return; }
      try {
        await apiPost("/reports", { post_id: "", target_user: "", type: "feedback", dest: "king", reporter_name: meName(), reporter_email: ME.email, note: v });
        closeModal(); toast("تم الإرسال — شكراً لك", "ok");
      } catch { toast("تعذر الإرسال", "err"); }
    };
  };
}

/* ---------- router ---------- */
const ROUTES = {
  home: ["الرئيسية", viewHome],
  explore: ["استكشاف", viewExplore],
  create: ["إنشاء", viewCreate],
  store: ["السوق 🛍️", viewStore],
  reels: ["ريلز", viewReels],
  videos: ["فيديو", viewVideos],
  music: ["موسيقى", viewMusic],
  private: ["الخاصة \U0001F512", viewPrivate],
  friends: ["الأصدقاء", viewFriends],
  settings: ["الإعدادات", viewSettings],
  chat: ["الدردشة", viewChat],
  ai: ["زيفي AI", viewAI],
  notes: ["الإشعارات", viewNotes],
  profile: ["الحساب", viewProfile],
  post: ["منشور", viewPost],
  stats: ["الإحصائيات", viewStats],
  gold: ["ZIVV Gold 👑", viewGold],
  king: ["صفحة الملك 🛡️", viewKing],
};
function parseHash() {
  const h = (location.hash || "#/home").replace(/^#\/?/, "");
  const [pathPart, qs] = h.split("?");
  const segs = pathPart.split("/").filter(Boolean);
  let name = segs[0] || "home";
  let extra = segs[1] || "";
  if (!ROUTES[name]) { name = "home"; extra = ""; }
  return { name, extra, params: new URLSearchParams(qs || "") };
}
async function render() {
  clearTimers(); clearObservers();
  try { if (S.ymAudio) { S.ymAudio.pause(); S.ymAudio = null; } } catch {}
  closeDrawer();
  S.chatLast = "";
  const { name, extra, params } = parseHash();
  S.route = name;
  renderTopbar(name, ROUTES[name][0], params);
  setBottomNav(name, params);
  $$(".view").forEach((v) => v.classList.remove("active"));
  const el = $("#view-" + name);
  el.classList.add("active");
  window.scrollTo({ top: 0 });
  try { await ROUTES[name][1](el, params, extra); }
  catch (e) { console.error(e); }
  if (name === "notes") updateBadge();
}

/* ---------- init ---------- */
window.addEventListener("hashchange", render);
$("#drawer-bg").onclick = closeDrawer;

(async function init() {
  try {
    const h = await apiGet("/health");
    if (h && h.ephemeral) {
      const bar = document.createElement("div");
      bar.style.cssText = "background:#fff8e1;color:#8a6d00;font-size:12px;font-weight:700;text-align:center;padding:7px 12px;border-bottom:1px solid #f0e0b0";
      bar.textContent = "☁️ وضع سحابي مؤقت — اربط Supabase من Vercel للحفظ الدائم";
      $("#ig-app").prepend(bar);
    }
  } catch {}
  await Promise.all([loadPeople(), loadGold()]);
  paintBottomAvatar();
  render();
  updateBadge();
  setInterval(updateBadge, 20000);
})();
