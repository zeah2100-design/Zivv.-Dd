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
      <a class="drawer-link" href="#/create"><span class="ico">➕</span> إنشاء جديد</a>
      <a class="drawer-link" href="#/store"><span class="ico">🛍️</span> السوق</a>
      <a class="drawer-link" href="#/chat"><span class="ico">💬</span> الدردشة</a>
      <a class="drawer-link" href="#/ai"><span class="ico">✨</span> زيفي AI</a>
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
      $(".ei", btn).textContent = on ? "❤️" : "🤍";
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
  el.innerHTML = `<div class="wrap-wide">
    <div class="search-bar">
      <input class="input" id="ex-q" placeholder="🔍 بحث في المنشورات والأشخاص…" value="${esc(q0)}" />
    </div>
    <div id="ex-users"></div>
    <div id="ex-posts"><div class="skel"></div></div>
  </div>`;
  const run = async () => {
    const q = ($("#ex-q").value || "").trim();
    await Promise.all([loadPeople(), loadGold()]);
    const [posts, likes, follows] = await Promise.all([apiGet("/posts?limit=200"), apiGet("/likes"), apiGet("/follows")]);
    const likeCount = {};
    (likes || []).forEach((l) => { likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1; });
    const following = new Set((follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === meKey()).map((f) => String(f.following || f.to_user || "").toLowerCase()));
    // users
    const ql = q.toLowerCase();
    const users = Array.from(S.people.values()).filter((u) => u.username !== meKey());
    const matched = q ? users.filter((u) => (u.name + " " + u.username).toLowerCase().includes(ql)).slice(0, 8) : users.slice(0, 5);
    const userRow = (u) => {
      const isF = following.has(u.username);
      return `<div class="user-row">${avatarHTML(u, "sm", isGold(u.username))}
        <div class="who"><b><a href="#/profile?u=${encodeURIComponent(u.username)}">${esc(u.name)}</a> ${nameBadges(u.username)}</b><span>@${esc(u.username)}</span></div>
        <button class="btn ${isF ? "ghost" : "soft"} sm" data-follow="${esc(u.username)}" data-on="${isF ? "0" : "1"}">${isF ? "إلغاء" : "متابعة"}</button>
      </div>`;
    };
    const ubox = $("#ex-users");
    if (ubox) ubox.innerHTML = matched.length ? `<div class="card" style="padding:8px 14px"><b style="font-size:14px">👥 الأشخاص</b>${matched.map(userRow).join("")}</div>` : "";
    $$("[data-follow]", el).forEach((b) => (b.onclick = async () => {
      try { await apiPost("/follows", { from_user: meKey(), to_user: b.getAttribute("data-follow"), on: b.getAttribute("data-on") === "1" }); toast("تم", "ok"); run(); }
      catch { toast("تعذر تنفيذ الأمر", "err"); }
    }));
    // grid
    let fp = posts || [];
    if (q) fp = fp.filter((p) => ((p.title || "") + " " + (p.body || p.text || "") + " " + ((p.tags || []).join(" "))).toLowerCase().includes(ql));
    const box = $("#ex-posts");
    if (!box) return;
    box.innerHTML = fp.length ? `<div class="media-grid">${fp.map((p) => {
      const m = mediaOf(p);
      const inner = !m ? `<div class="txt-tile">${esc((p.title || p.body || p.text || "").slice(0, 70))}</div>`
        : (m.kind === "video" ? `<video src="${esc(m.src)}" preload="metadata" muted></video><span class="vflag">🎬</span>` : `<img src="${esc(m.src)}" loading="lazy" />`);
      return `<div class="media-cell" data-open="${esc(p.id)}">${inner}<div class="ov">❤️ ${likeCount[p.id] || 0}</div></div>`;
    }).join("")}</div>` : `<div class="card empty"><span class="big">🔍</span>لا توجد نتائج.</div>`;
    $$("[data-open]", box).forEach((c) => (c.onclick = () => { location.hash = "#/post/" + c.getAttribute("data-open"); }));
  };
  let deb = null;
  $("#ex-q").oninput = () => { clearTimeout(deb); deb = setTimeout(run, 350); };
  run();
}

/* ---------- reels ---------- */
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
    box.innerHTML = `<div class="reels-feed">${withMedia.map(({ p, m }) => {
      const uname = String(p.username || p.user || "");
      const owner = personOf(uname);
      const liked = likedByMe.has(String(p.id));
      const media = m.kind === "video"
        ? `<video src="${esc(m.src)}" muted loop playsinline preload="metadata"></video>`
        : `<img class="rm" src="${esc(m.src)}" loading="lazy" />`;
      const canFollow = uname.toLowerCase() !== meKey() && !following.has(uname.toLowerCase());
      return `<div class="reel" data-reel="${esc(p.id)}">
        ${media}<div class="shade"></div>
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
          if (v) v.play().catch(() => {});
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
      <div class="threads-head">💬 المحادثات <span style="flex:1"></span><button class="btn soft sm" id="chat-new">+ جديد</button></div>
      <div style="padding:10px 12px 0"><input class="input" id="chat-q" placeholder="بحث…" /></div>
      <div class="threads-list" id="chat-threads"></div>
    </div>
    <div class="convo" id="chat-convo"><div class="empty"><span class="big">💬</span>اختر محادثة أو ابدأ واحدة جديدة.</div></div>
  </div></div>`;

  let all = [];
  async function refreshThreads() {
    try {
      all = await apiGet("/messages");
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
        const peer = th === meKey() ? from : th;
        if (!peer) return;
        if (!groups.has(peer)) groups.set(peer, []);
        groups.get(peer).push(m);
      });
      let peers = Array.from(groups.entries()).map(([peer, msgs]) => {
        msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return { peer, last: msgs[msgs.length - 1] };
      }).sort((a, b) => new Date((b.last || {}).created_at || 0) - new Date((a.last || {}).created_at || 0));
      if (q) {
        const extra = Array.from(S.people.values()).filter((u) => u.username !== meKey() && (u.name + " " + u.username).toLowerCase().includes(q) && !groups.has(u.username));
        extra.forEach((u) => peers.push({ peer: u.username, last: null }));
      } else if (peer0 && !groups.has(peer0)) {
        peers.unshift({ peer: peer0, last: null });
      }
      const box = $("#chat-threads");
      if (!box) return;
      box.innerHTML = peers.length ? peers.map(({ peer, last }) => {
        const who = personOf(peer);
        const prev = !last ? "ابدأ المحادثة" : (last.kind === "image" ? "📷 صورة" : esc(String(last.body || "").slice(0, 40)));
        return `<div class="thread-row ${S.chatPeer === peer ? "active" : ""}" data-peer="${esc(peer)}">
          ${avatarHTML(who, "sm", isGold(peer))}<div class="who"><b>${esc(who.name)} ${nameBadges(peer)}</b><span>${prev}</span></div></div>`;
      }).join("") : `<div class="empty"><span class="big">📭</span>لا توجد محادثات.</div>`;
      $$("#chat-threads [data-peer]").forEach((r) => (r.onclick = () => openThread(r.getAttribute("data-peer"))));
      if (S.chatPeer) paintConvo();
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
    const sig = msgs.map((m) => m.id).join(",");
    const body = $("#convo-body");
    if (body && S.chatLast === sig && $("#convo-peer") && $("#convo-peer").dataset.u === peer) return;
    S.chatLast = sig;
    convo.innerHTML = `
      <div class="convo-head" id="convo-peer" data-u="${esc(peer)}">
        <button class="icon-btn back-btn" id="convo-back">→</button>
        ${avatarHTML(who, "sm", isGold(peer))}
        <a href="#/profile?u=${encodeURIComponent(peer)}" style="text-decoration:none"><b>${esc(who.name)} ${nameBadges(peer)}</b><br/><span style="font-size:12px;color:var(--muted);font-weight:400">@${esc(peer)}</span></a>
      </div>
      <div class="convo-body" id="convo-body">
        ${msgs.length ? msgs.map((m) => {
          const mine = String(m.from_user || m.from_key || "").toLowerCase() === meKey();
          const img = m.image_url || m.image ? `<img src="${esc(m.image_url || m.image)}" alt="" loading="lazy" />` : "";
          return `<div class="msg ${mine ? "me" : "them"}"><div class="b">${img}${esc(m.body || "")}<time>${esc(timeAgo(m.created_at))}</time></div></div>`;
        }).join("") : `<div class="empty"><span class="big">👋</span>ابدأ المحادثة مع ${esc(who.name)}</div>`}
      </div>
      <form class="convo-form" id="convo-form">
        <button class="icon-btn" type="button" id="convo-img" title="صورة">🖼️</button>
        <input class="input" id="convo-inp" placeholder="اكتب رسالة…" autocomplete="off" maxlength="1000" />
        <button class="btn" type="submit">إرسال</button>
      </form>`;
    const cb = $("#convo-body");
    cb.scrollTop = cb.scrollHeight;
    $("#convo-back").onclick = () => { S.chatPeer = null; $("#chat-layout").classList.remove("thread-open"); $("#chat-convo").innerHTML = `<div class="empty"><span class="big">💬</span>اختر محادثة.</div>`; refreshThreads(); };
    $("#convo-form").onsubmit = async (e) => {
      e.preventDefault();
      const inp = $("#convo-inp");
      const v = inp.value.trim();
      if (!v) return;
      inp.value = "";
      try {
        await apiPost("/messages", { thread_user: peer, from_key: meKey(), from_user: meKey(), name: meName(), kind: "text", body: v });
        await refreshThreads();
      } catch { toast("تعذر الإرسال", "err"); }
    };
    $("#convo-img").onclick = async () => {
      const f = await pickFile("image/*");
      if (!f) return;
      toast("جاري الرفع…");
      try {
        const url = await uploadImage(f);
        await apiPost("/messages", { thread_user: peer, from_key: meKey(), from_user: meKey(), name: meName(), kind: "image", body: "", image_url: url });
        await refreshThreads();
      } catch { toast("تعذر الإرسال", "err"); }
    };
  }
  function openThread(peer) {
    S.chatPeer = String(peer).toLowerCase();
    S.chatLast = "";
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

/* ---------- AI ---------- */
const AI_SYS = "أنت «زيفي»، مساعد ذكي عربي ودود داخل منصة تواصل اجتماعي اسمها ZIVV. أجب بالعربية دائماً باختصار وفائدة.";
async function viewAI(el) {
  el.innerHTML = `<div class="wrap-wide">
    <div class="ai-hero"><span class="ai-orb">✨</span><div><b>زيفي AI</b><small>مساعدك الذكي بالعربية — محادثاتك محفوظة والعدّادات حقيقية</small></div></div>
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
        `<div class="ai-msg ${m.role === "user" ? "user" : "bot"}"><div class="b">${esc(m.content || "")}</div></div>`
      ).join("") || `<div class="empty"><span class="big">✨</span>ابدأ الكلام مع زيفي.</div>`;
      box.scrollTop = box.scrollHeight;
    } catch { box.innerHTML = `<p style="color:var(--red)">تعذر التحميل</p>`; }
  }
  async function sendText(text) {
    if (!text || !S.aiChat) return;
    const box = $("#ai-msgs");
    const inp = $("#ai-inp");
    inp.value = ""; inp.disabled = true;
    box.insertAdjacentHTML("beforeend", `<div class="ai-msg user"><div class="b">${esc(text)}</div></div>`);
    box.insertAdjacentHTML("beforeend", `<div class="ai-msg bot" id="ai-typing"><div class="b typing"><span></span><span></span><span></span></div></div>`);
    box.scrollTop = box.scrollHeight;
    try {
      await apiPost("/ai-messages", { chat_id: S.aiChat, role: "user", content: text });
      const history = await apiGet("/ai-messages?chat_id=" + encodeURIComponent(S.aiChat));
      const msgs = [{ role: "system", content: AI_SYS }]
        .concat((history || []).filter((m) => m.role !== "system").slice(-12).map((m) => ({ role: m.role, content: m.content })));
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
  await refreshUsage();
  await refreshChats();
  if (S.aiChat) { $("#ai-form").style.display = ""; $("#ai-chips").style.display = ""; openChat(); }
}

/* ---------- notes ---------- */
async function viewNotes(el) {
  el.innerHTML = `<div class="wrap-narrow"><div class="card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><b style="font-size:16px">الإشعارات</b><span style="flex:1"></span>
    <button class="btn soft sm" id="notes-read">تعليم الكل كمقروء</button></div>
    <div id="notes-list"><div class="skel"></div></div>
  </div></div>`;
  $("#notes-read").onclick = async () => {
    try { await apiPost("/notes-read", { dest: meKey() }); toast("تم", "ok"); viewNotes(el); updateBadge(); }
    catch { toast("تعذر التحديث", "err"); }
  };
  try {
    const notes = await apiGet("/notes?dest=" + encodeURIComponent(meKey()));
    const box = $("#notes-list");
    if (!box) return;
    box.innerHTML = (notes || []).length ? notes.map((n) => {
      const unread = n.unread === 1 || n.unread === true || n.unread === "true";
      const who = personOf(n.from_user);
      const icon = n.type === "like" ? "❤️" : n.type === "comment" ? "💬" : "📢";
      return `<div class="note">${unread ? `<span class="dot"></span>` : `<span style="width:8px;flex-shrink:0"></span>`}
        ${avatarHTML({ ...who, name: n.from_name || who.name }, "sm")}
        <div style="flex:1"><p><b>${esc(n.from_name || who.name || "")}</b> ${esc(n.body || n.title || "")} ${icon}</p>
        <time>${esc(timeAgo(n.created_at))}</time></div></div>`;
    }).join("") : `<div class="empty"><span class="big">🤍</span>لا توجد إشعارات بعد.</div>`;
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
async function viewKing(el) {
  if (!isAdmin()) {
    el.innerHTML = `<div class="wrap-narrow"><div class="card empty"><span class="big">🛡️</span>صفحة خاصة بإدارة المنصة فقط.</div></div>`;
    return;
  }
  el.innerHTML = `<div class="wrap-wide"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    await loadPeople();
    const [stats, golds, reports, accounts, posts] = await Promise.all([
      apiGet("/stats"), apiGet("/gold"), apiGet("/reports"), apiGet("/accounts"), apiGet("/posts?limit=500"),
    ]);
    const s = (stats && stats.stats) || {};
    const pend = (golds || []).filter((g) => g.status === "pending").length;
    el.innerHTML = `<div class="wrap-wide">
      <div class="card"><b style="font-size:17px">🛡️ صفحة الملك — لوحة الإدارة</b>
        <div style="font-size:12px;color:var(--muted)">تحكم كامل حقيقي في المنصة</div></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="v">${s.accounts || 0}</div><div class="l">مستخدم</div></div>
        <div class="stat-card"><div class="v">${s.posts || 0}</div><div class="l">منشور</div></div>
        <div class="stat-card"><div class="v">${pend}</div><div class="l">طلب جولد معلق</div></div>
        <div class="stat-card"><div class="v">${(reports || []).length}</div><div class="l">بلاغ</div></div>
      </div>
      <div class="ptabs" style="border:none;margin:0 0 10px">
        <button class="ptab active" data-ktab="gold">👑 طلبات الجولد (${(golds || []).length})</button>
        <button class="ptab" data-ktab="reports">🚩 البلاغات (${(reports || []).length})</button>
        <button class="ptab" data-ktab="users">👥 المستخدمون (${(accounts || []).length})</button>
      </div>
      <div class="card" id="king-body" style="padding:8px 14px"></div>
    </div>`;

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
          <tr><th>المُبلغ</th><th>المستهدف</th><th>السبب</th><th>المنشور</th></tr>
          ${(reports || []).map((r) => `<tr>
            <td><b>${esc(r.reporter_name || "")}</b><br/><small style="color:var(--muted)">${esc(r.reporter_email || "")}</small></td>
            <td>@${esc(r.target_user || "")}</td><td>${esc(r.note || "")}</td>
            <td>${r.post_id ? `<a href="#/post/${esc(r.post_id)}">فتح</a>` : "—"}</td></tr>`).join("")}</table></div>`
          : `<div class="empty"><span class="big">✅</span>لا توجد بلاغات.</div>`;
      } else {
        box.innerHTML = `<div style="overflow-x:auto"><table class="table">
          <tr><th>المستخدم</th><th>البريد</th><th>منشورات</th></tr>
          ${(accounts || []).map((a) => {
            const u = String(a.username || "").toLowerCase();
            const np = (posts || []).filter((p) => String(p.username || p.user || "").toLowerCase() === u).length;
            return `<tr><td><a href="#/profile?u=${encodeURIComponent(u)}" style="text-decoration:none"><b>@${esc(u)}</b></a><br/><small style="color:var(--muted)">${esc(a.name || "")}</small></td>
              <td><small>${esc(a.email || "")}</small></td><td><b>${np}</b></td></tr>`;
          }).join("")}</table></div>`;
      }
    }
    async function goldAct(id, action) {
      try {
        await apiPost("/gold", { id, action, by: meKey() });
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
async function viewStore(el) {
  el.innerHTML = `<div class="wrap-wide">
    <div class="market-notice">🛍️ <b>سوق ZIVV للإعلانات والتواصل فقط</b> — البيع والشراء والدفع والاستلام يتم مباشرة بين البائع والمشتري، والمنصة لا تضمن أي صفقة.</div>
    <div class="search-bar">
      <input class="input" id="st-q" placeholder="🔍 ابحث في السوق…" />
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

/* ---------- router ---------- */
const ROUTES = {
  home: ["الرئيسية", viewHome],
  explore: ["استكشاف", viewExplore],
  create: ["إنشاء", viewCreate],
  store: ["السوق 🛍️", viewStore],
  reels: ["ريلز", viewReels],
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
