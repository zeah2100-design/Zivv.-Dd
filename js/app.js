/* ============================================================
   ZIVV App — كل البيانات حقيقية 100% من قاعدة البيانات
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
  const r = await fetch("/api" + path, { headers: { "Accept": "application/json" } });
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
  if (d < 30) return "منذ " + d + " يوم";
  const mo = Math.floor(d / 30);
  if (mo < 12) return "منذ " + mo + " شهر";
  return "منذ " + Math.floor(mo / 12) + " سنة";
}

const AVC = ["#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb", "#db2777", "#0d9488", "#4f46e5"];
function avatarColor(key) {
  let h = 0; const s = String(key || "?");
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) >>> 0);
  return AVC[h % AVC.length];
}
function avatarHTML(p, cls) {
  p = p || {};
  const nm = String(p.name || p.username || "?").trim() || "?";
  const init = esc(nm.charAt(0));
  const bg = avatarColor(p.username || nm);
  const av = p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.remove()" />` : "";
  return `<span class="avatar ${cls || ""}" style="background:${bg}">${init}${av}</span>`;
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
function pickImage() {
  return new Promise((res) => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*";
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

/* ---------- state ---------- */
const S = {
  route: "home",
  timers: [],
  people: new Map(),
  viewed: new Set(),
  chatPeer: null,
  chatLast: "",
  aiChat: null,
};
function later(fn, ms) { const id = setInterval(fn, ms); S.timers.push(id); return id; }
function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }

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

/* ---------- notify (real notes) ---------- */
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

/* ---------- post card ---------- */
function postCard(p, ctx) {
  ctx = ctx || {};
  const owner = personOf(p.username || p.user);
  const liked = !!ctx.liked;
  const canDel = String(p.username || p.user || "").toLowerCase() === meKey();
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const img = p.image || p.image_url || "";
  const uname = esc(p.username || p.user || "");
  return `
  <article class="card post" data-post="${esc(p.id)}">
    <div class="post-head">
      ${avatarHTML({ ...owner, name: p.name || owner.name })}
      <div class="who">
        <b><a href="#/profile?u=${encodeURIComponent(p.username || p.user || "")}" style="text-decoration:none">${esc(p.name || owner.name || "")}</a></b>
        <span>@${uname} · ${esc(timeAgo(p.created_at))}</span>
      </div>
      ${canDel ? `<button class="mini-btn" data-del="${esc(p.id)}">حذف</button>` : ""}
    </div>
    ${p.title ? `<div class="post-title">${esc(p.title)}</div>` : ""}
    ${p.body || p.text ? `<p class="post-body">${esc(p.body || p.text || "")}</p>` : ""}
    ${img ? `<img class="post-img" src="${esc(img)}" alt="" loading="lazy" />` : ""}
    ${tags.length ? `<div class="post-tags">${tags.map((t) => `<span class="tag" data-tag="${esc(t)}">#${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="post-actions">
      <button class="act ${liked ? "liked" : ""}" data-like="${esc(p.id)}">♥ <span class="n" data-likes-n>${ctx.likes || 0}</span></button>
      <button class="act" data-comments="${esc(p.id)}">💬 <span class="n" data-comments-n>${ctx.comments || 0}</span></button>
      <span class="act static">👁 <span class="n" data-views-n>${ctx.views || 0}</span></span>
    </div>
    <div class="comments" id="c-${esc(p.id)}"></div>
  </article>`;
}

function bindFeed(root, posts) {
  // like buttons
  $$("[data-like]", root).forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-like");
      const on = !btn.classList.contains("liked");
      btn.classList.toggle("liked", on);
      const nEl = $("[data-likes-n]", btn);
      const cur = parseInt(nEl.textContent || "0", 10) || 0;
      nEl.textContent = String(Math.max(0, cur + (on ? 1 : -1)));
      try {
        await apiPost("/likes", { post_id: id, user_key: meKey(), on });
        if (on) { const p = (posts || []).find((x) => String(x.id) === String(id)); if (p) notifyOwner(p, "like"); }
      } catch { toast("تعذر تسجيل الإعجاب", "err"); }
    };
  });
  // comments toggle
  $$("[data-comments]", root).forEach((btn) => {
    btn.onclick = () => toggleComments(btn.getAttribute("data-comments"), posts);
  });
  // delete
  $$("[data-del]", root).forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("حذف هذا المنشور نهائياً؟")) return;
      try {
        await apiDel("/posts?id=" + encodeURIComponent(btn.getAttribute("data-del")) + "&user=" + encodeURIComponent(meKey()));
        toast("تم حذف المنشور", "ok");
        render();
      } catch { toast("تعذر الحذف", "err"); }
    };
  });
  // tags
  $$("[data-tag]", root).forEach((t) => {
    t.onclick = () => { location.hash = "#/explore?q=" + encodeURIComponent(t.getAttribute("data-tag")); };
  });
  // views observer (real)
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.getAttribute("data-post");
      io.unobserve(en.target);
      if (!id || S.viewed.has(id)) return;
      S.viewed.add(id);
      apiPost("/views", { post_id: id, user_key: meKey() }).then((out) => {
        const nEl = $(`[data-post="${CSS.escape(id)}"] [data-views-n]`, root);
        if (nEl && out && typeof out.views === "number") nEl.textContent = String(out.views);
      }).catch(() => {});
    });
  }, { threshold: 0.4 });
  $$(".post[data-post]", root).forEach((el) => io.observe(el));
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
      <div class="bubble"><b>${esc(c.name || who.name || "")}</b>${esc(c.body || "")}<time>${esc(timeAgo(c.created_at))}</time></div></div>`;
  }).join("");
  box.innerHTML = `${items || `<p style="color:var(--muted);font-size:13px">لا توجد تعليقات بعد — كن أول من يعلق.</p>`}
    <form class="comment-form" data-cform="${esc(postId)}">
      <input class="input" placeholder="اكتب تعليقاً…" required maxlength="500" />
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
      const row = await apiPost("/comments", { post_id: postId, name: meName(), user_key: meKey(), body });
      const fresh = await apiGet("/comments?post_id=" + encodeURIComponent(postId));
      paintComments(box, postId, fresh || [], posts);
      const card = document.querySelector(`[data-post="${CSS.escape(postId)}"] [data-comments-n]`);
      if (card) card.textContent = String((fresh || []).length);
      const p = (posts || []).find((x) => String(x.id) === String(postId));
      if (p) notifyOwner(p, "comment", body);
      void row;
    } catch { toast("تعذر نشر التعليق", "err"); inp.disabled = false; }
  };
}

/* ---------- views ---------- */
async function viewHome(el) {
  el.innerHTML = `<div class="feed">
    <div class="card composer">
      <div class="row">${avatarHTML({ username: meKey(), name: meName(), avatar: (personOf(meKey()) || {}).avatar })}
        <textarea class="textarea" id="composer-text" placeholder="بم تفكر يا ${esc(meName())}؟" style="min-height:70px"></textarea>
      </div>
      <div class="img-preview" id="composer-prev"><img alt="" /><button type="button" id="composer-img-x">✕</button></div>
      <div class="actions">
        <button class="btn soft sm" id="composer-img" type="button">🖼 صورة</button>
        <span style="flex:1"></span>
        <button class="btn sm" id="composer-send" type="button">نشر</button>
      </div>
    </div>
    <div id="feed-list"><div class="skel"></div><div class="skel"></div></div>
  </div>`;

  let pendingImage = "";
  $("#composer-img").onclick = async () => {
    const f = await pickImage();
    if (!f) return;
    toast("جاري رفع الصورة…");
    try {
      pendingImage = await uploadImage(f);
      const pv = $("#composer-prev");
      $("img", pv).src = pendingImage;
      pv.classList.add("show");
      toast("تم رفع الصورة", "ok");
    } catch { toast("تعذر رفع الصورة", "err"); }
  };
  $("#composer-img-x").onclick = () => { pendingImage = ""; $("#composer-prev").classList.remove("show"); };
  $("#composer-send").onclick = async () => {
    const ta = $("#composer-text");
    const body = ta.value.trim();
    if (!body && !pendingImage) { toast("اكتب شيئاً أو أرفق صورة", "err"); return; }
    const btn = $("#composer-send");
    btn.disabled = true; btn.textContent = "جاري النشر…";
    try {
      await apiPost("/posts", {
        username: meKey(), name: meName(),
        avatar: (personOf(meKey()) || {}).avatar || "",
        title: "", body, type: pendingImage ? "image" : "text",
        image_url: pendingImage, tags: [], dests: ["home", "explore"], status: "ok",
      });
      toast("تم النشر بنجاح", "ok");
      viewHome(el);
    } catch { toast("تعذر النشر", "err"); btn.disabled = false; btn.textContent = "نشر"; }
  };

  try {
    await loadPeople();
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
    if (!posts || !posts.length) {
      list.innerHTML = `<div class="card empty"><span class="big">📝</span>لا توجد منشورات بعد.<br/>انشر أول منشور من الأعلى.</div>`;
      return;
    }
    list.innerHTML = posts.map((p) => postCard(p, {
      likes: likeCount[p.id] || 0, liked: likedByMe.has(String(p.id)),
      comments: commentCount[p.id] || 0, views: viewCount[p.id] || 0,
    })).join("");
    bindFeed(list, posts);
  } catch {
    $("#feed-list").innerHTML = `<div class="card empty"><span class="big">⚠️</span>تعذر تحميل المنشورات.<br/><button class="btn sm" onclick="location.reload()">إعادة المحاولة</button></div>`;
  }
}

async function viewExplore(el, params) {
  const q0 = params.get("q") || "";
  el.innerHTML = `<div class="grid2">
    <div>
      <div class="search-bar">
        <input class="input" id="ex-q" placeholder="ابحث في المنشورات والأشخاص…" value="${esc(q0)}" />
        <button class="btn" id="ex-go">بحث</button>
      </div>
      <div id="ex-users"></div>
      <h3 class="section-title">المنشورات</h3>
      <div id="ex-posts"><div class="skel"></div></div>
    </div>
    <div>
      <div class="card"><b>🔥 وسوم رائجة</b><div id="ex-tags" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div></div>
      <div class="card"><b>👥 أشخاص قد تعرفهم</b><div id="ex-people"></div></div>
    </div>
  </div>`;

  const run = async () => {
    const q = ($("#ex-q").value || "").trim();
    await loadPeople();
    const [posts, likes, comments, views, follows] = await Promise.all([
      apiGet("/posts?limit=200"), apiGet("/likes"), apiGet("/comments"), apiGet("/views"), apiGet("/follows"),
    ]);
    const likeCount = {}, likedByMe = new Set();
    (likes || []).forEach((l) => { likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1; if (String(l.user_key || "").toLowerCase() === meKey()) likedByMe.add(String(l.post_id)); });
    const commentCount = {};
    (comments || []).forEach((c) => { commentCount[c.post_id] = (commentCount[c.post_id] || 0) + 1; });
    const viewCount = (views && views.counts) || {};
    const following = new Set((follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === meKey()).map((f) => String(f.following || f.to_user || "").toLowerCase()));

    // trending tags (real)
    const tagN = {};
    (posts || []).forEach((p) => {
      (Array.isArray(p.tags) ? p.tags : []).forEach((t) => { tagN[t] = (tagN[t] || 0) + 1; });
      (String(p.body || p.text || "").match(/#[\u0600-\u06FF\w]+/g) || []).forEach((t) => { tagN[t.slice(1)] = (tagN[t.slice(1)] || 0) + 1; });
    });
    const top = Object.entries(tagN).sort((a, b) => b[1] - a[1]).slice(0, 15);
    $("#ex-tags").innerHTML = top.length ? top.map(([t, n]) => `<span class="tag" data-xtag="${esc(t)}">#${esc(t)} (${n})</span>`).join("") : `<span style="color:var(--muted);font-size:13px">لا توجد وسوم بعد</span>`;
    $$("#ex-tags [data-xtag]").forEach((t) => (t.onclick = () => { $("#ex-q").value = t.getAttribute("data-xtag"); run(); }));

    // people
    const ql = q.toLowerCase();
    const users = Array.from(S.people.values()).filter((u) => u.username !== meKey());
    const matchedUsers = q ? users.filter((u) => (u.name + " " + u.username).toLowerCase().includes(ql)) : users.slice(0, 6);
    const userRow = (u) => {
      const isF = following.has(u.username);
      return `<div class="user-row">${avatarHTML(u, "sm")}
        <div class="who"><b><a href="#/profile?u=${encodeURIComponent(u.username)}" style="text-decoration:none">${esc(u.name)}</a></b><span>@${esc(u.username)}</span></div>
        <button class="btn ${isF ? "ghost" : "soft"} sm" data-follow="${esc(u.username)}" data-on="${isF ? "0" : "1"}">${isF ? "إلغاء المتابعة" : "متابعة"}</button>
      </div>`;
    };
    $("#ex-people").innerHTML = users.slice(0, 6).map(userRow).join("") || `<p style="color:var(--muted);font-size:13px">لا يوجد مستخدمون بعد</p>`;
    $("#ex-users").innerHTML = q ? `<div class="card"><b>👥 الأشخاص</b>${matchedUsers.map(userRow).join("") || `<p style="color:var(--muted);font-size:13px">لا نتائج</p>`}</div>` : "";
    $$("[data-follow]", el).forEach((b) => (b.onclick = async () => {
      const u = b.getAttribute("data-follow");
      const on = b.getAttribute("data-on") === "1";
      try { await apiPost("/follows", { from_user: meKey(), to_user: u, on }); toast(on ? "تمت المتابعة" : "تم إلغاء المتابعة", "ok"); run(); }
      catch { toast("تعذر تنفيذ الأمر", "err"); }
    }));

    // posts filter
    let fp = posts || [];
    if (q) fp = fp.filter((p) => ((p.title || "") + " " + (p.body || p.text || "") + " " + ((p.tags || []).join(" "))).toLowerCase().includes(ql));
    const box = $("#ex-posts");
    box.innerHTML = fp.length ? fp.map((p) => postCard(p, { likes: likeCount[p.id] || 0, liked: likedByMe.has(String(p.id)), comments: commentCount[p.id] || 0, views: viewCount[p.id] || 0 })).join("")
      : `<div class="card empty"><span class="big">🔍</span>لا توجد نتائج مطابقة.</div>`;
    bindFeed(box, fp);
  };
  $("#ex-go").onclick = run;
  $("#ex-q").onkeydown = (e) => { if (e.key === "Enter") run(); };
  run();
}

/* ----- chat ----- */
function threadKey(a, b) { return [a, b].sort().join("|"); }
async function viewChat(el, params) {
  const peer0 = (params.get("u") || "").toLowerCase();
  el.innerHTML = `<div class="chat-layout" id="chat-layout">
    <div class="threads">
      <div class="threads-head">💬 المحادثات <span style="flex:1"></span><button class="btn soft sm" id="chat-new">+ جديد</button></div>
      <div style="padding:10px 12px 0"><input class="input" id="chat-q" placeholder="ابحث عن شخص…" /></div>
      <div class="threads-list" id="chat-threads"></div>
    </div>
    <div class="convo" id="chat-convo"><div class="empty"><span class="big">💬</span>اختر محادثة أو ابدأ واحدة جديدة.</div></div>
  </div>`;

  let all = [];
  async function refreshThreads() {
    try {
      all = await apiGet("/messages");
      await loadPeople();
      const q = ($("#chat-q").value || "").toLowerCase();
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
        return { peer, last: msgs[msgs.length - 1], msgs };
      }).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
      // include searched people
      if (q) {
        const extra = Array.from(S.people.values()).filter((u) => u.username !== meKey() && (u.name + " " + u.username).toLowerCase().includes(q) && !groups.has(u.username));
        extra.forEach((u) => peers.push({ peer: u.username, last: null, msgs: [] }));
      } else if (peer0 && !groups.has(peer0)) {
        peers.unshift({ peer: peer0, last: null, msgs: [] });
      }
      const box = $("#chat-threads");
      box.innerHTML = peers.length ? peers.map(({ peer, last }) => {
        const who = personOf(peer);
        const prev = !last ? "ابدأ المحادثة" : last.kind === "image" ? "📷 صورة" : esc(String(last.body || "").slice(0, 40));
        return `<div class="thread-row ${S.chatPeer === peer ? "active" : ""}" data-peer="${esc(peer)}">
          ${avatarHTML(who, "sm")}<div class="who"><b>${esc(who.name)}</b><span>${prev}</span></div></div>`;
      }).join("") : `<div class="empty"><span class="big">📭</span>لا توجد محادثات بعد.</div>`;
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
    const msgs = msgsWith(peer);
    const sig = msgs.map((m) => m.id).join(",");
    const body = $("#convo-body");
    if (body && S.chatLast === sig && $("#convo-peer") && $("#convo-peer").dataset.u === peer) return;
    S.chatLast = sig;
    convo.innerHTML = `
      <div class="convo-head" id="convo-peer" data-u="${esc(peer)}">
        <button class="icon-btn back-btn" id="convo-back">→</button>
        ${avatarHTML(who, "sm")}
        <a href="#/profile?u=${encodeURIComponent(peer)}" style="text-decoration:none"><b>${esc(who.name)}</b><br/><span style="font-size:12px;color:var(--muted);font-weight:400">@${esc(peer)}</span></a>
      </div>
      <div class="convo-body" id="convo-body">
        ${msgs.length ? msgs.map((m) => {
          const mine = String(m.from_user || m.from_key || "").toLowerCase() === meKey();
          const img = m.image_url || m.image ? `<img src="${esc(m.image_url || m.image)}" alt="" loading="lazy" />` : "";
          return `<div class="msg ${mine ? "me" : "them"}"><div class="b">${img}${esc(m.body || "")}<time>${esc(timeAgo(m.created_at))}</time></div></div>`;
        }).join("") : `<div class="empty"><span class="big">👋</span>ابدأ المحادثة مع ${esc(who.name)}</div>`}
      </div>
      <form class="convo-form" id="convo-form">
        <button class="icon-btn" type="button" id="convo-img" title="إرسال صورة">🖼</button>
        <input class="input" id="convo-inp" placeholder="اكتب رسالة…" autocomplete="off" maxlength="1000" />
        <button class="btn" type="submit">إرسال</button>
      </form>`;
    const cb = $("#convo-body");
    cb.scrollTop = cb.scrollHeight;
    const back = $("#convo-back");
    if (back) back.onclick = () => { S.chatPeer = null; $("#chat-layout").classList.remove("thread-open"); $("#chat-convo").innerHTML = `<div class="empty"><span class="big">💬</span>اختر محادثة.</div>`; refreshThreads(); };
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
      const f = await pickImage();
      if (!f) return;
      toast("جاري رفع الصورة…");
      try {
        const url = await uploadImage(f);
        await apiPost("/messages", { thread_user: peer, from_key: meKey(), from_user: meKey(), name: meName(), kind: "image", body: "", image_url: url });
        await refreshThreads();
      } catch { toast("تعذر إرسال الصورة", "err"); }
    };
  }
  function openThread(peer) {
    S.chatPeer = String(peer).toLowerCase();
    S.chatLast = "";
    $("#chat-layout").classList.add("thread-open");
    paintConvo();
    refreshThreads();
  }
  $("#chat-new").onclick = () => { $("#chat-q").focus(); toast("ابحث عن شخص واختره لبدء محادثة"); };
  $("#chat-q").oninput = refreshThreads;
  if (peer0) { S.chatPeer = peer0; $("#chat-layout").classList.add("thread-open"); }
  await refreshThreads();
  later(async () => {
    try {
      const fresh = await apiGet("/messages");
      const sigAll = (fresh || []).length + "|" + ((fresh || []).slice(-1)[0] || {}).id;
      if (sigAll !== S.chatAllSig) { S.chatAllSig = sigAll; all = fresh; if (S.chatPeer) paintConvo(); refreshThreads(); }
    } catch {}
  }, 3000);
}

/* ----- AI ----- */
const AI_SYS = "أنت «زيفي»، مساعد ذكي عربي ودود داخل منصة تواصل اجتماعي اسمها ZIVV. أجب بالعربية دائماً باختصار وفائدة، واستخدم تنسيقاً بسيطاً مقروءاً.";
async function viewAI(el) {
  el.innerHTML = `<div class="ai-layout">
    <div class="ai-chats">
      <div class="threads-head">✨ محادثات زيفي <span style="flex:1"></span><button class="btn soft sm" id="ai-new">+ جديد</button></div>
      <div class="threads-list" id="ai-list"></div>
    </div>
    <div class="ai-main">
      <div class="ai-usage" id="ai-usage"></div>
      <div class="ai-msgs" id="ai-msgs"><div class="empty"><span class="big">✨</span>اختر محادثة أو ابدأ واحدة جديدة مع زيفي.</div></div>
      <form class="convo-form" id="ai-form" style="display:none">
        <input class="input" id="ai-inp" placeholder="اسأل زيفي أي شيء…" autocomplete="off" maxlength="2000" />
        <button class="btn" type="submit">إرسال</button>
      </form>
    </div>
  </div>`;

  async function refreshUsage() {
    try {
      const u = await apiGet("/ai-usage?user=" + encodeURIComponent(meKey()));
      $("#ai-usage").innerHTML = `<span>📊 استهلاك اليوم (حقيقي من القاعدة):</span>
        <span class="pill">💬 <b>${u.chats_count || 0}</b> رسالة</span>
        <span class="pill">🔤 <b>${Number(u.tokens_used || 0).toLocaleString("en")}</b> توكن</span>`;
    } catch { $("#ai-usage").innerHTML = ""; }
  }
  async function refreshChats() {
    try {
      const chats = await apiGet("/ai-chats?user=" + encodeURIComponent(meKey()));
      const box = $("#ai-list");
      box.innerHTML = (chats || []).length ? chats.map((c) =>
        `<div class="ai-chat-row ${S.aiChat === c.id ? "active" : ""}" data-chat="${esc(c.id)}">💬<div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title || "دردشة")}</div><small>${esc(timeAgo(c.updated_at || c.created_at))}</small></div></div>`
      ).join("") : `<div class="empty"><span class="big">✨</span>لا توجد محادثات بعد.</div>`;
      $$("#ai-list [data-chat]").forEach((r) => (r.onclick = () => { S.aiChat = r.getAttribute("data-chat"); $("#ai-form").style.display = ""; refreshChats(); openChat(); }));
    } catch {}
  }
  async function openChat() {
    const id = S.aiChat;
    if (!id) return;
    const box = $("#ai-msgs");
    box.innerHTML = `<p style="color:var(--muted)">جاري تحميل الرسائل…</p>`;
    try {
      const msgs = await apiGet("/ai-messages?chat_id=" + encodeURIComponent(id));
      box.innerHTML = (msgs || []).filter((m) => m.role !== "system").map((m) =>
        `<div class="ai-msg ${m.role === "user" ? "user" : "bot"}"><div class="b">${esc(m.content || "")}</div></div>`
      ).join("") || `<div class="empty"><span class="big">✨</span>ابدأ الكلام مع زيفي.</div>`;
      box.scrollTop = box.scrollHeight;
    } catch { box.innerHTML = `<p style="color:var(--red)">تعذر تحميل الرسائل</p>`; }
  }
  $("#ai-new").onclick = async () => {
    try {
      const c = await apiPost("/ai-chats", { user_key: meKey(), title: "دردشة جديدة" });
      S.aiChat = c.id;
      $("#ai-form").style.display = "";
      await refreshChats();
      await openChat();
      $("#ai-inp").focus();
    } catch { toast("تعذر إنشاء المحادثة", "err"); }
  };
  $("#ai-form").onsubmit = async (e) => {
    e.preventDefault();
    const inp = $("#ai-inp");
    const text = inp.value.trim();
    if (!text || !S.aiChat) return;
    inp.value = ""; inp.disabled = true;
    const box = $("#ai-msgs");
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
      // update chat title from first message
      if ((history || []).filter((m) => m.role === "user").length <= 1) {
        await apiPost("/ai-chats", { id: S.aiChat, user_key: meKey(), title: text.slice(0, 40) }).catch(() => {});
      }
      $("#ai-typing").remove();
      box.insertAdjacentHTML("beforeend", `<div class="ai-msg bot"><div class="b">${esc(reply)}</div></div>`);
      box.scrollTop = box.scrollHeight;
      refreshChats(); refreshUsage();
    } catch (ex) {
      const t = $("#ai-typing"); if (t) t.remove();
      box.insertAdjacentHTML("beforeend", `<div class="ai-msg bot"><div class="b">⚠️ تعذر الاتصال بزيفي الآن. حاول مجدداً.</div></div>`);
    } finally { inp.disabled = false; inp.focus(); }
  };
  await refreshUsage();
  await refreshChats();
  if (S.aiChat) { $("#ai-form").style.display = ""; openChat(); }
}

/* ----- notes ----- */
async function viewNotes(el) {
  el.innerHTML = `<div class="feed"><div class="card">
    <div style="display:flex;align-items:center;gap:10px"><b style="font-size:17px">🔔 الإشعارات</b><span style="flex:1"></span>
    <button class="btn soft sm" id="notes-read">تعليم الكل كمقروء</button></div>
    <div id="notes-list"><div class="skel"></div></div>
  </div></div>`;
  $("#notes-read").onclick = async () => {
    try { await apiPost("/notes-read", { dest: meKey() }); toast("تم تعليم الكل كمقروء", "ok"); viewNotes(el); updateBadge(); }
    catch { toast("تعذر التحديث", "err"); }
  };
  try {
    const notes = await apiGet("/notes?dest=" + encodeURIComponent(meKey()));
    const box = $("#notes-list");
    box.innerHTML = (notes || []).length ? notes.map((n) => {
      const unread = n.unread === 1 || n.unread === true || n.unread === "true";
      const who = personOf(n.from_user);
      const icon = n.type === "like" ? "♥" : n.type === "comment" ? "💬" : "📢";
      return `<div class="note">${unread ? `<span class="dot"></span>` : `<span style="width:9px;flex-shrink:0"></span>`}
        ${avatarHTML({ ...who, name: n.from_name || who.name }, "sm")}
        <div style="flex:1"><p><b>${esc(n.from_name || who.name || "")}</b> ${esc(n.body || n.title || "")} <span style="color:var(--muted)">${icon}</span></p>
        <time>${esc(timeAgo(n.created_at))}</time></div></div>`;
    }).join("") : `<div class="empty"><span class="big">🔔</span>لا توجد إشعارات بعد.<br/>عندما يعجب شخص بمنشورك أو يعلق عليه ستظهر هنا.</div>`;
  } catch { $("#notes-list").innerHTML = `<div class="empty">تعذر تحميل الإشعارات</div>`; }
}
async function updateBadge() {
  try {
    const notes = await apiGet("/notes?dest=" + encodeURIComponent(meKey()));
    const n = (notes || []).filter((x) => x.unread === 1 || x.unread === true || x.unread === "true").length;
    [["#notes-count"], ["#notes-count-m"]].forEach(([sel]) => {
      const b = $(sel);
      if (b) { b.style.display = n ? "" : "none"; b.textContent = String(n); }
    });
  } catch {}
}

/* ----- profile ----- */
async function viewProfile(el, params) {
  const u = (params.get("u") || meKey()).toLowerCase();
  const isMe = u === meKey();
  el.innerHTML = `<div id="prof-box"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    await loadPeople();
    const [posts, likes, follows] = await Promise.all([apiGet("/posts?limit=300"), apiGet("/likes"), apiGet("/follows")]);
    const who = personOf(u);
    const myPosts = (posts || []).filter((p) => String(p.username || p.user || "").toLowerCase() === u);
    const ids = new Set(myPosts.map((p) => String(p.id)));
    const likesGot = (likes || []).filter((l) => ids.has(String(l.post_id))).length;
    const followers = (follows || []).filter((f) => String(f.following || f.to_user || "").toLowerCase() === u);
    const following = (follows || []).filter((f) => String(f.follower || f.from_user || "").toLowerCase() === u);
    const amFollowing = followers.some((f) => String(f.follower || f.from_user || "").toLowerCase() === meKey());

    el.innerHTML = `<div class="card">
      <div class="profile-top">
        ${avatarHTML(who, "lg")}
        <div class="info">
          <h2>${esc(who.name || u)}</h2>
          <div class="u">@${esc(u)}${who.city ? " · 📍 " + esc(who.city) : ""}</div>
          ${who.bio ? `<p style="margin:6px 0 0;font-size:14px">${esc(who.bio)}</p>` : ""}
          <div class="profile-counts"><span><b>${myPosts.length}</b> منشور</span><span><b>${followers.length}</b> متابِع</span><span><b>${following.length}</b> يتابع</span><span><b>${likesGot}</b> ♥</span></div>
        </div>
        <div style="display:flex;gap:8px">
          ${isMe ? `<button class="btn soft sm" id="prof-edit-btn">✏️ تعديل حسابي</button>`
            : `${amFollowing ? `<button class="btn ghost sm" id="prof-follow" data-on="0">إلغاء المتابعة</button>` : `<button class="btn sm" id="prof-follow" data-on="1">+ متابعة</button>`}
               <a class="btn soft sm" href="#/chat?u=${encodeURIComponent(u)}">💬 مراسلة</a>`}
        </div>
      </div>
      <div id="prof-edit" style="display:none;margin-top:14px;border-top:1px dashed var(--line);padding-top:14px"></div>
    </div>
    <h3 class="section-title">${isMe ? "منشوراتي" : "منشورات " + esc(who.name || u)}</h3>
    <div id="prof-posts"></div>`;

    if (isMe) {
      $("#prof-edit-btn").onclick = () => {
        const box = $("#prof-edit");
        const open = box.style.display !== "none";
        box.style.display = open ? "none" : "";
        if (open) return;
        box.innerHTML = `
          <div style="display:grid;gap:10px;max-width:480px">
            <div style="display:flex;gap:10px;align-items:center" id="prof-av-row">${avatarHTML(who, "")}<button class="btn soft sm" type="button" id="prof-av-btn">تغيير الصورة</button></div>
            <div class="field"><label>الاسم</label><input class="input" id="pe-name" value="${esc(who.name || "")}" /></div>
            <div class="field"><label>نبذة</label><input class="input" id="pe-bio" value="${esc(who.bio || "")}" placeholder="اكتب نبذة عنك…" /></div>
            <div class="field"><label>المدينة</label><input class="input" id="pe-city" value="${esc(who.city || "")}" placeholder="القاهرة" /></div>
            <div><button class="btn sm" id="pe-save">حفظ التعديلات</button></div>
          </div>`;
        let newAv = who.avatar || "";
        $("#prof-av-btn").onclick = async () => {
          const f = await pickImage();
          if (!f) return;
          toast("جاري رفع الصورة…");
          try { newAv = await uploadImage(f); $("#prof-av-row").firstElementChild.outerHTML = avatarHTML({ username: u, name: who.name, avatar: newAv }, ""); toast("تم الرفع", "ok"); }
          catch { toast("تعذر الرفع", "err"); }
        };
        $("#pe-save").onclick = async () => {
          try {
            await apiPost("/profiles", {
              email: ME.email, username: u,
              name: $("#pe-name").value.trim() || who.name,
              avatar: newAv, bio: $("#pe-bio").value.trim(), city: $("#pe-city").value.trim(),
            });
            ME.name = $("#pe-name").value.trim() || ME.name;
            localStorage.setItem("zivv.session", JSON.stringify(ME));
            toast("تم حفظ التعديلات", "ok");
            viewProfile(el, params);
          } catch { toast("تعذر الحفظ", "err"); }
        };
      };
    } else {
      $("#prof-follow").onclick = async (e) => {
        const on = e.target.getAttribute("data-on") === "1";
        try { await apiPost("/follows", { from_user: meKey(), to_user: u, on }); toast(on ? "تمت المتابعة" : "تم إلغاء المتابعة", "ok"); viewProfile(el, params); }
        catch { toast("تعذر تنفيذ الأمر", "err"); }
      };
    }

    // posts with counts
    const [comments, views] = await Promise.all([apiGet("/comments"), apiGet("/views")]);
    const likeCount = {}, likedByMe = new Set();
    (likes || []).forEach((l) => { likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1; if (String(l.user_key || "").toLowerCase() === meKey()) likedByMe.add(String(l.post_id)); });
    const commentCount = {};
    (comments || []).forEach((c) => { commentCount[c.post_id] = (commentCount[c.post_id] || 0) + 1; });
    const viewCount = (views && views.counts) || {};
    const box = $("#prof-posts");
    box.innerHTML = myPosts.length ? myPosts.map((p) => postCard(p, { likes: likeCount[p.id] || 0, liked: likedByMe.has(String(p.id)), comments: commentCount[p.id] || 0, views: viewCount[p.id] || 0 })).join("")
      : `<div class="card empty"><span class="big">📝</span>لا توجد منشورات بعد.</div>`;
    bindFeed(box, myPosts);
  } catch { el.innerHTML = `<div class="card empty">تعذر تحميل الحساب</div>`; }
}

/* ----- stats ----- */
async function viewStats(el) {
  el.innerHTML = `<div id="stats-box"><div class="skel"></div><div class="skel"></div></div>`;
  try {
    const [stats, posts, views] = await Promise.all([apiGet("/stats"), apiGet("/posts?limit=200"), apiGet("/views")]);
    const s = (stats && stats.stats) || {};
    const vc = (views && views.counts) || {};
    const cards = [
      ["👥", s.accounts || 0, "مستخدم"],
      ["📝", s.posts || 0, "منشور"],
      ["♥", s.likes || 0, "إعجاب"],
      ["💬", s.comments || 0, "تعليق"],
      ["👁", s.views || 0, "مشاهدة"],
      ["✉️", s.messages || 0, "رسالة دردشة"],
      ["🤝", s.follows || 0, "متابعة"],
      ["✨", s.ai_chats || 0, "محادثة ذكاء"],
      ["🔤", s.ai_messages || 0, "رسالة ذكاء"],
      ["🔔", s.notes || 0, "إشعار"],
      ["📖", s.stories || 0, "ستوري"],
      ["🛍", s.products || 0, "منتج"],
    ];
    const ai = s.ai_usage_today || { chats: 0, tokens: 0, images: 0 };
    const top = (posts || []).map((p) => ({ p, v: vc[p.id] || 0 })).sort((a, b) => b.v - a.v).slice(0, 8);
    el.innerHTML = `
      <div class="card"><b>📊 لوحة الإحصائيات — أرقام حقيقية مباشرة من قاعدة البيانات</b>
        <div style="font-size:12px;color:var(--muted)">المحرك: ${esc((stats && stats.mode) || "")} · آخر تحديث: ${esc(timeAgo((stats && stats.timestamp) || Date.now()))}</div></div>
      <div class="stat-grid">${cards.map(([i, v, l]) => `<div class="stat-card"><div style="font-size:22px">${i}</div><div class="v">${Number(v).toLocaleString("en")}</div><div class="l">${l}</div></div>`).join("")}</div>
      <div class="card"><b>✨ استهلاك الذكاء الاصطناعي اليوم (كل المستخدمين)</b>
        <div class="stat-grid" style="margin:10px 0 0">
          <div class="stat-card"><div class="v">${ai.chats}</div><div class="l">رسالة ذكاء اليوم</div></div>
          <div class="stat-card"><div class="v">${Number(ai.tokens).toLocaleString("en")}</div><div class="l">توكن اليوم</div></div>
        </div></div>
      <div class="card"><b>🔥 الأعلى مشاهدة</b>
        <div style="overflow-x:auto;margin-top:8px"><table class="table">
          <tr><th>المنشور</th><th>الكاتب</th><th>👁</th></tr>
          ${top.map(({ p, v }) => `<tr><td>${esc((p.title || p.body || p.text || "").slice(0, 60))}</td><td>@${esc(p.username || p.user || "")}</td><td><b>${v}</b></td></tr>`).join("") || `<tr><td colspan="3">لا توجد بيانات</td></tr>`}
        </table></div></div>`;
  } catch { el.innerHTML = `<div class="card empty">تعذر تحميل الإحصائيات</div>`; }
}

/* ---------- router ---------- */
const ROUTES = {
  home: ["الرئيسية", viewHome],
  explore: ["استكشاف", viewExplore],
  chat: ["الدردشة", viewChat],
  ai: ["زيفي AI", viewAI],
  notes: ["الإشعارات", viewNotes],
  profile: ["الحساب", viewProfile],
  stats: ["الإحصائيات", viewStats],
};
function parseHash() {
  const h = (location.hash || "#/home").replace(/^#\/?/, "");
  const [name, qs] = h.split("?");
  return { name: ROUTES[name] ? name : "home", params: new URLSearchParams(qs || "") };
}
async function render() {
  clearTimers();
  S.chatLast = "";
  const { name, params } = parseHash();
  S.route = name;
  $$("#side-nav .nav-link, #bottom-nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("data-route") === name));
  $("#page-title").textContent = ROUTES[name][0];
  $$(".view").forEach((v) => v.classList.remove("active"));
  const el = $("#view-" + name);
  el.classList.add("active");
  window.scrollTo({ top: 0 });
  try { await ROUTES[name][1](el, params); }
  catch (e) { console.error(e); }
  if (name === "notes") updateBadge();
}

/* ---------- global ---------- */
$("#btn-theme").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "" : "dark";
  if (cur) document.documentElement.setAttribute("data-theme", cur);
  else document.documentElement.removeAttribute("data-theme");
  try { localStorage.setItem("zivv.theme", cur); } catch {}
  $("#btn-theme").textContent = cur ? "☀️" : "🌙";
};
if (document.documentElement.getAttribute("data-theme") === "dark") $("#btn-theme").textContent = "☀️";
$("#btn-logout").onclick = () => {
  if (!confirm("تسجيل الخروج؟")) return;
  localStorage.removeItem("zivv.session");
  location.replace("index.html");
};
$("#btn-refresh").onclick = () => { S.viewed.clear(); render(); toast("تم التحديث"); };
window.addEventListener("hashchange", render);

(async function init() {
  // تنبيه الوضع السحابي المؤقت (بدون Supabase)
  try {
    const h = await apiGet("/health");
    if (h && h.ephemeral) {
      const bar = document.createElement("div");
      bar.style.cssText = "background:var(--amber-soft);color:var(--amber);font-size:12.5px;font-weight:700;text-align:center;padding:8px 12px;border-bottom:1px solid var(--line)";
      bar.textContent = "☁️ وضع سحابي مؤقت — البيانات قد تُمسح عند خمول السيرفر. اربط Supabase من لوحة Vercel للحفظ الدائم.";
      document.querySelector(".main").prepend(bar);
    }
  } catch {}
  await loadPeople();
  const me = personOf(meKey());
  $("#side-me").innerHTML = `${avatarHTML({ ...me, name: meName() }, "sm")}
    <div style="flex:1;min-width:0"><b style="font-size:13.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meName())}</b>
    <span style="font-size:11.5px;color:var(--muted)">@${esc(meKey())}</span></div>`;
  render();
  updateBadge();
  setInterval(updateBadge, 20000);
})();
