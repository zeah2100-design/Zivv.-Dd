(function () {
  const GOLD_POINTS = 10000;
  const LIKES_PACK = 1000;
  const POINTS_PACK = 100;
  const GOLD_MS = 30 * 24 * 60 * 60 * 1000;
  const FREE_CHATS = 10;
  const FREE_CHAT_MS = 60 * 60 * 1000;
  const FREE_IMAGES = 10;
  const PAY_KEY = "zivv.goldPay";
  const NOTES_KEY = "zivv.notes";
  const QUOTA_KEY = "zivv.aiQuota";
  const SEEDS = {};

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
  function meUser() {
    if (window.ZIVV_CORE && ZIVV_CORE.author) {
      return String(ZIVV_CORE.author().user || "").replace(/^@/, "").toLowerCase();
    }
    const s = read("zivv.session", {});
    return String(s.username || (s.email || "guest").split("@")[0] || "guest")
      .replace(/^@/, "")
      .toLowerCase();
  }
  function meName() {
    if (window.ZIVV_CORE && ZIVV_CORE.meName) return ZIVV_CORE.meName();
    const s = read("zivv.session", {});
    return s.name || "أنت";
  }
  function keyOf(user) {
    return String(user || meUser() || "")
      .replace(/^@/, "")
      .toLowerCase();
  }
  function payConfig() {
    return Object.assign(
      {
        price: 149,
        vodafone: "01012345678",
        instapay: "zivv@instapay",
        wallet: "فودافون كاش / إنستا باي",
        hint: "حوّل المبلغ واكتب في التحويل: ذهبي + اسم المستخدم. الملك يفعّل بعد التحويل.",
      },
      read(PAY_KEY, {})
    );
  }
  function savePayConfig(next) {
    write(PAY_KEY, Object.assign(payConfig(), next || {}));
  }
  function store() {
    const map = read("zivv.creator", {});
    let dirty = false;
    Object.keys(SEEDS).forEach((u) => {
      if (!map[u]) {
        map[u] = Object.assign({ user: u, points: 0, likePointsGranted: 0 }, SEEDS[u]);
        dirty = true;
      }
    });
    if (dirty) write("zivv.creator", map);
    return map;
  }
  function save(map) {
    write("zivv.creator", map);
  }
  function blank(u) {
    return {
      user: u,
      name: u === meUser() ? meName() : u,
      points: 0,
      posts: 0,
      views: 0,
      likes: 0,
      likePointsGranted: 0,
      gold: false,
      joined: false,
      payPending: false,
    };
  }
  function of(user) {
    const u = keyOf(user);
    return store()[u] || blank(u);
  }
  function bump(user, patch) {
    const u = keyOf(user);
    if (!u || u === "guest") return of(u);
    const map = store();
    const cur = map[u] || blank(u);
    Object.keys(patch || {}).forEach((k) => {
      if (k === "posts" || k === "views" || k === "likes") {
        cur[k] = (Number(cur[k]) || 0) + Number(patch[k] || 0);
      } else if (k === "points") {
        cur[k] = Math.max(0, (Number(cur[k]) || 0) + Number(patch[k] || 0));
      } else cur[k] = patch[k];
    });
    if ((cur.posts || 0) > 0) cur.joined = true;
    map[u] = cur;
    save(map);
    return cur;
  }
  function grantGold(user, how) {
    const u = keyOf(user);
    const prev = of(u);
    const now = Date.now();
    const base = prev.gold && Number(prev.goldUntil) > now ? Number(prev.goldUntil) : now;
    const cur = bump(u, {
      gold: true,
      payPending: false,
      goldHow: how || "points",
      goldAt: now,
      goldUntil: base + GOLD_MS,
      goldExpiredNote: false,
    });
    const list = read("zivv.goldReqs", []);
    list.unshift({
      id: "g_ok_" + u + "_" + Date.now(),
      user: u,
      name: cur.name || u,
      status: "accepted",
      dest: "king",
      note: how === "cash" ? "ذهبي نقدي — الملك فعّله شهر" : "ذهبي مجاني شهر بـ ١٠٬٠٠٠ نقطة",
      at: now,
      until: cur.goldUntil,
      earned: how !== "cash",
    });
    write("zivv.goldReqs", list);
    return cur;
  }
  function expireGold(user, silent) {
    const u = keyOf(user);
    const cur = of(u);
    bump(u, { gold: false });
    if (!silent && !cur.goldExpiredNote) {
      bump(u, { goldExpiredNote: true });
      pushNote(u, {
        type: "official",
        title: "انتهى الاشتراك الذهبي",
        text: "اشتراكك الذهبي خلص تلقائي. جدّده من الإعدادات بـ ١٠٬٠٠٠ نقطة أو نقدي عشان المميزات ترجع.",
        href: "settings.html",
      });
    }
    return of(u);
  }
  function sweepGold(user) {
    const u = keyOf(user || meUser());
    const cur = of(u);
    if (cur.gold && !cur.goldUntil) {
      bump(u, { goldUntil: (Number(cur.goldAt) || Date.now()) + GOLD_MS });
    }
    const now = of(u);
    if (now.gold && Number(now.goldUntil) > 0 && Number(now.goldUntil) <= Date.now()) {
      expireGold(u);
      return false;
    }
    return !!(now.gold && (!now.goldUntil || Number(now.goldUntil) > Date.now()));
  }
  function sweepAllGold() {
    const map = store();
    Object.keys(map).forEach((u) => {
      if (map[u] && (map[u].gold || map[u].goldUntil)) sweepGold(u);
    });
  }
  function goldLeft(user) {
    sweepGold(user);
    const cur = of(user);
    const active = !!(cur.gold && Number(cur.goldUntil) > Date.now());
    const ms = active ? Number(cur.goldUntil) - Date.now() : 0;
    return {
      gold: active,
      ms,
      days: Math.floor(ms / 86400000),
      hours: Math.floor((ms % 86400000) / 3600000),
      minutes: Math.floor((ms % 3600000) / 60000),
      seconds: Math.floor((ms % 60000) / 1000),
      until: Number(cur.goldUntil) || 0,
    };
  }
  function dayStamp() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function loadQuota() {
    const u = meUser();
    let q = read(QUOTA_KEY, {});
    if (!q || q.user !== u || q.day !== dayStamp()) {
      q = { user: u, day: dayStamp(), chats: [], images: 0 };
      write(QUOTA_KEY, q);
    }
    if (!Array.isArray(q.chats)) q.chats = [];
    return q;
  }
  function saveQuota(q) {
    write(QUOTA_KEY, q);
  }
  function aiStatus() {
    if (sweepGold(meUser())) {
      return { gold: true, chatsLeft: Infinity, imagesLeft: Infinity, chatsUsed: 0, imagesUsed: 0, chatMs: Infinity };
    }
    const q = loadQuota();
    return {
      gold: false,
      chatsLeft: Math.max(0, FREE_CHATS - q.chats.length),
      imagesLeft: Math.max(0, FREE_IMAGES - (Number(q.images) || 0)),
      chatsUsed: q.chats.length,
      imagesUsed: Number(q.images) || 0,
      chatMs: FREE_CHAT_MS,
    };
  }
  function aiChatLeft(id) {
    if (sweepGold(meUser())) return { ok: true, gold: true, left: Infinity };
    const q = loadQuota();
    const row = q.chats.find((c) => c.id === id);
    if (!row) return { ok: false, reason: "missing", left: 0 };
    const left = FREE_CHAT_MS - (Date.now() - Number(row.at || 0));
    if (left <= 0) return { ok: false, reason: "expired", left: 0 };
    return { ok: true, left, gold: false };
  }
  function aiStartChat(id, kind) {
    if (sweepGold(meUser())) return { ok: true, gold: true, left: Infinity };
    const q = loadQuota();
    const row = q.chats.find((c) => c.id === id);
    if (row) return aiChatLeft(id);
    if (q.chats.length >= FREE_CHATS) return { ok: false, reason: "limit", left: 0 };
    q.chats.push({ id: id, at: Date.now(), kind: kind || "chat" });
    saveQuota(q);
    return { ok: true, left: FREE_CHAT_MS, gold: false };
  }
  function aiUseImage() {
    if (sweepGold(meUser())) return { ok: true, gold: true, left: Infinity };
    const q = loadQuota();
    if ((Number(q.images) || 0) >= FREE_IMAGES) return { ok: false, reason: "images", left: 0 };
    q.images = (Number(q.images) || 0) + 1;
    saveQuota(q);
    return { ok: true, left: FREE_IMAGES - q.images, gold: false };
  }
  function likesOfUser(user) {
    const u = keyOf(user);
    if (!window.ZIVV_CORE || !ZIVV_CORE.getPosts) return Number(of(u).likes) || 0;
    return ZIVV_CORE.getPosts()
      .filter((p) => String(p.user || "").toLowerCase() === u)
      .reduce((s, p) => s + (ZIVV_CORE.likeCount ? ZIVV_CORE.likeCount(p) : Number(p.likes) || 0), 0);
  }
  function syncLikePoints(user) {
    const u = keyOf(user);
    const likes = likesOfUser(u);
    const earned = Math.floor(likes / LIKES_PACK) * POINTS_PACK;
    const map = store();
    const cur = map[u] || blank(u);
    const prev = Number(cur.likePointsGranted) || 0;
    cur.likes = likes;
    if (earned !== prev) {
      cur.points = Math.max(0, (Number(cur.points) || 0) + (earned - prev));
      cur.likePointsGranted = earned;
    }
    map[u] = cur;
    save(map);
    return cur;
  }
  function join() {
    const u = meUser();
    const cur = of(u);
    if (!cur.joined) bump(u, { joined: true, joinedAt: Date.now(), name: meName() });
    else bump(u, { name: meName() });
    return syncLikePoints(u);
  }
  function isIn(user) {
    const c = of(user);
    if (c.joined || (c.posts || 0) > 0) return true;
    const s = read("zivv.session", {});
    return !!(s && s.onboarding && s.onboarding.creator && keyOf(user) === meUser());
  }
  function isGoldUser(user) {
    return sweepGold(user);
  }
  function top(n) {
    const map = store();
    return Object.keys(map)
      .map((u) => {
        const row = Object.assign({ user: u }, map[u]);
        row.gold = isGoldUser(u);
        return row;
      })
      .filter((c) => c.joined || (c.posts || 0) > 0 || c.gold)
      .sort((a, b) => (b.gold - a.gold) || (b.points || 0) - (a.points || 0) || (b.likes || 0) - (a.likes || 0))
      .slice(0, n || 8);
  }
  function myPostCount() {
    const u = meUser();
    const posts = window.ZIVV_CORE && ZIVV_CORE.getPosts ? ZIVV_CORE.getPosts() : read("zivv.feed", []);
    return posts.filter((p) => String(p.user || "").toLowerCase() === u).length;
  }
  function recordView(post) {
    if (!post || !post.id || !post.user) return;
    const author = String(post.user).toLowerCase();
    if (author === meUser()) return;
    let seen = [];
    try {
      seen = JSON.parse(sessionStorage.getItem("zivv.seen") || "[]");
    } catch {
      seen = [];
    }
    if (seen.indexOf(post.id) >= 0) return;
    seen.push(post.id);
    try {
      sessionStorage.setItem("zivv.seen", JSON.stringify(seen.slice(-200)));
    } catch {}
    bump(author, { views: 1 });
  }
  function progress(user) {
    const c = syncLikePoints(user);
    const pts = Number(c.points) || 0;
    return {
      points: pts,
      need: GOLD_POINTS,
      left: Math.max(0, GOLD_POINTS - pts),
      pct: Math.min(100, Math.round((pts / GOLD_POINTS) * 100)),
      gold: sweepGold(c.user),
      likes: Number(c.likes) || 0,
      likePoints: Number(c.likePointsGranted) || 0,
      nextPack: LIKES_PACK - ((Number(c.likes) || 0) % LIKES_PACK),
      payPending: !!c.payPending,
    };
  }
  function notes() {
    return read(NOTES_KEY, []);
  }
  function pushNote(to, payload) {
    const list = notes();
    list.unshift(
      Object.assign(
        {
          id: "n_" + Date.now(),
          to: keyOf(to),
          type: "official",
          title: "",
          text: "",
          at: Date.now(),
          href: "creators.html",
          unread: true,
        },
        payload || {}
      )
    );
    write(NOTES_KEY, list.slice(0, 120));
    return list[0];
  }
  function myNotes() {
    const u = meUser();
    const mail = String((read("zivv.session", {}) || {}).email || "").toLowerCase();
    return notes().filter((n) => n.to === u || n.to === mail);
  }
  function payText() {
    const p = payConfig();
    return (
      "الاشتراك الذهبي نقدًا: " +
      p.price +
      " ج.م\n" +
      "فودافون كاش: " +
      p.vodafone +
      "\n" +
      "إنستا باي: " +
      p.instapay +
      "\n" +
      (p.hint || "")
    );
  }
  function buyWithPoints() {
    const u = meUser();
    if (isGoldUser(u)) return { ok: false, reason: "gold" };
    const c = syncLikePoints(u);
    if ((Number(c.points) || 0) < GOLD_POINTS) {
      return { ok: false, reason: "points", have: c.points, need: GOLD_POINTS };
    }
    bump(u, { points: -GOLD_POINTS });
    grantGold(u, "points");
    pushNote(u, {
      type: "official",
      title: "الاشتراك الذهبي",
      text: "اتفعّل بالـنقاط. خصمنا ١٠٬٠٠٠ نقطة. حسابك بقى مميز.",
      href: "profile.html",
    });
    return { ok: true, how: "points" };
  }
  function buyWithCash() {
    const u = meUser();
    if (isGoldUser(u)) return { ok: false, reason: "gold" };
    const c = of(u);
    if (c.payPending) return { ok: true, how: "cash", already: true };
    bump(u, { payPending: true, name: meName() });
    const list = read("zivv.goldReqs", []);
    list.unshift({
      id: "g_cash_" + Date.now(),
      user: u,
      name: meName(),
      status: "pending",
      dest: "king",
      pay: "cash",
      note: "طلب دفع نقدي للاشتراك الذهبي — استنى رسالة الملك",
      at: Date.now(),
    });
    write("zivv.goldReqs", list);
    const reports = read("zivv.reports", []);
    reports.unshift({
      id: "r_goldcash_" + Date.now(),
      type: "gold-cash",
      dest: "king",
      targetUser: u,
      targetName: meName(),
      reporterName: meName(),
      reporterEmail: meUser(),
      note: "طلب ذهبي نقدي",
      at: Date.now(),
    });
    write("zivv.reports", reports);
    return { ok: true, how: "cash" };
  }

  function wrapCore() {
    if (!window.ZIVV_CORE || ZIVV_CORE._creatorWrapped) return;
    ZIVV_CORE._creatorWrapped = true;
    const add = ZIVV_CORE.addPost;
    ZIVV_CORE.addPost = function () {
      const made = add.apply(this, arguments);
      if (made && !made.blocked) {
        bump(made.user, { posts: 1, joined: true, name: made.name });
      }
      return made;
    };
    const like = ZIVV_CORE.toggleLike;
    ZIVV_CORE.toggleLike = function (postId) {
      const now = like.apply(this, arguments);
      const post = ZIVV_CORE.getPosts().find((p) => p.id === postId);
      if (post && post.user) syncLikePoints(post.user);
      return now;
    };
    const origGold = ZIVV_CORE.isGold;
    ZIVV_CORE.isGold = function (user) {
      if (isGoldUser(user || meUser())) return true;
      return !!(origGold && origGold(user));
    };
    const origStat = ZIVV_CORE.goldStatus;
    ZIVV_CORE.goldStatus = function (user) {
      const u = keyOf(user || meUser());
      if (isGoldUser(u)) return "gold";
      if (of(u).payPending) return "pending";
      return origStat ? origStat(user) : "none";
    };
    const setG = ZIVV_CORE.setGold;
    ZIVV_CORE.setGold = function (id, status) {
      const r = setG.apply(this, arguments);
      if (r && status === "accepted") {
        grantGold(r.user, r.pay === "cash" ? "cash" : "king");
        pushNote(r.user, {
          type: "official",
          title: "الاشتراك الذهبي",
          text: "الملك فعّل حسابك الذهبي. المميزات شغالة دلوقتي.",
          href: "profile.html",
        });
      }
      if (r && status === "rejected") {
        bump(r.user, { payPending: false });
        pushNote(r.user, {
          type: "official",
          title: "طلب الذهبي",
          text: "الطلب اترفض. تقدر تدفع بالنقاط أو تبعت التحويل تاني.",
          href: "creators.html",
        });
      }
      return r;
    };
  }

  function togglePromo(postId) {
    if (!isGoldUser(meUser())) return false;
    const posts = read("zivv.feed", []);
    const p = posts.find((x) => x.id === postId);
    if (!p) return false;
    if (String(p.user || "").toLowerCase() !== meUser()) return false;
    p.promoted = !p.promoted;
    write("zivv.feed", posts);
    return !!p.promoted;
  }

  function paintHome() {
    return;
    const mine = myPostCount();
    const pg = progress(meUser());
    let box = document.getElementById("creator-banner");
    if (!box) {
      const feed = document.querySelector("main.feed") || document.querySelector("main");
      if (!feed) return;
      box = document.createElement("div");
      box.id = "creator-banner";
      const composer = document.getElementById("composer");
      if (composer && composer.parentNode) composer.parentNode.insertBefore(box, composer.nextSibling);
      else feed.insertBefore(box, feed.firstChild);
    }
    if (pg.gold && mine >= 1) {
      box.innerHTML = "";
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    box.innerHTML = `<div class="cr-banner">
      <b>صانع محتوى؟ انشر واللايكات تتحول لنقاط</b>
      <p>كل ١٠٠٠ لايك على منشوراتك = ١٠٠ نقطة. الاشتراك الذهبي ببلاش بـ ١٠٬٠٠٠ نقطة، أو ادفع نقدي.</p>
      <div class="cr-bar"><i style="width:${pg.pct}%"></i></div>
      <p class="cr-meta">${pg.points} / ${pg.need} نقطة · ${pg.likes} لايك</p>
      <div class="cr-acts">
        <a class="cr-go" href="publish.html">انشر منشور</a>
        <button class="cr-more" type="button" id="cr-open-pay">الاشتراك الذهبي</button>
      </div>
    </div>`;
    const b = document.getElementById("cr-open-pay");
    if (b) b.onclick = openPay;
  }

  function paintPublish() {
    const file = (location.pathname.split("/").pop() || "").toLowerCase();
    if (file !== "publish.html") return;
    if (document.getElementById("cr-pub")) return;
    const wrap = document.querySelector("main.wrap") || document.querySelector("main");
    if (!wrap) return;
    const pg = progress(meUser());
    const el = document.createElement("div");
    el.id = "cr-pub";
    el.className = "cr-banner slim";
    el.innerHTML = pg.gold
      ? `<b>حساب ذهبي.</b> منشورك هيتوسم مميز ويظهر أقوى.`
      : `<b>كل ١٠٠٠ لايك = ١٠٠ نقطة.</b> ${pg.points} / ${GOLD_POINTS} للذهبي.`;
    const me = document.getElementById("me");
    if (me && me.parentNode) me.parentNode.insertBefore(el, me.nextSibling);
    else wrap.insertBefore(el, wrap.firstChild);
  }

  function openPay() {
    wrapCore();
    const u = meUser();
    if (isGoldUser(u)) {
      window.alert("حسابك ذهبي بالفعل.");
      return;
    }
    let modal = document.getElementById("cr-pay");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "cr-pay";
      modal.className = "cr-modal";
      document.body.appendChild(modal);
    }
    const pg = progress(u);
    modal.innerHTML = `
      <div class="cr-sheet">
        <h3>الاشتراك الذهبي</h3>
        <p>مميز عن العادي: شارة · إطار · إعلان على منشورك بس · زيفي أسرع وأطول · ظهور أقوى.</p>
        <p class="cr-meta">نقاطك: ${pg.points} / ${GOLD_POINTS}</p>
        <div class="cr-bar"><i style="width:${pg.pct}%"></i></div>
        <button class="cr-go" type="button" id="cr-pay-pts">ادفع ١٠٬٠٠٠ نقطة — مجاني</button>
        <button class="cr-cash" type="button" id="cr-pay-cash">اطلب الدفع نقدي — الملك هيبعت السعر</button>
        <button class="cr-x" type="button" id="cr-pay-x">إغلاق</button>
      </div>`;
    modal.classList.add("open");
    document.getElementById("cr-pay-x").onclick = () => modal.classList.remove("open");
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove("open");
    };
    document.getElementById("cr-pay-pts").onclick = () => {
      const r = buyWithPoints();
      if (!r.ok && r.reason === "points") {
        window.alert("نقاطك " + r.have + ". محتاج ١٠٬٠٠٠ نقطة (كل ١٠٠٠ لايك = ١٠٠ نقطة) أو ادفع نقدي.");
        return;
      }
      modal.classList.remove("open");
      window.alert("الذهبي اتفتح بالنقاط. حسابك بقى مميز.");
      location.reload();
    };
    document.getElementById("cr-pay-cash").onclick = () => {
      buyWithCash();
      modal.classList.remove("open");
      location.href = "alerts.html?t=official";
    };
  }

  function injectCss() {
    if (document.getElementById("cr-css")) return;
    const s = document.createElement("style");
    s.id = "cr-css";
    s.textContent = `
      .cr-banner{
        margin: 0 16px 12px; padding: 14px;
        border-radius: 16px; position: relative; overflow: hidden;
        background: #fffaeb;
        border: 1px solid #fedf89;
      }
      .cr-banner::before{
        content:""; position:absolute; inset:0; padding:1px; border-radius:16px;
        display:none;
      }
      .cr-banner b{ display:block; font-size:15px; margin-bottom:6px; color:#101418; }
      .cr-banner p{ color:#5b6470; font-size:13px; line-height:1.65; margin:0 0 10px; }
      .cr-meta{ color:#b45309 !important; font-size:12px !important; margin:8px 0 10px !important; }
      .cr-acts{ display:flex; gap:8px; flex-wrap:wrap; }
      .cr-go{
        display:inline-flex; align-items:center; justify-content:center;
        background: #111318;
        color:#fff; font-weight:800; border-radius:999px; padding:8px 14px; font-size:13px;
        text-decoration:none; border:0; width:100%;
      }
      .cr-more{ color:#b45309; font-size:13px; font-weight:700; align-self:center; text-decoration:none; background:none; border:0; }
      .cr-banner.slim{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .cr-banner.slim b{ margin:0; font-size:13px; }
      .cr-bar{ flex:1; min-width:80px; height:6px; background:#e9ecef; border-radius:99px; overflow:hidden; }
      .cr-bar i{ display:block; height:100%; background:#e1306c; }
      .gold-tag{
        display:inline-block; margin-inline-start:6px; font-size:10px; font-weight:800;
        background:#f59e0b; color:#3d2500;
        border-radius:999px; padding:1px 6px;
      }
      .ava.gold, .ava-gold{
        padding:2px; background:#f59e0b;
      }
      .who.gold-name{
        color:#b45309;
      }
      .cr-modal{
        display:none; position:fixed; inset:0; background:rgba(16,24,40,.4);
        z-index:80; place-items:center;
      }
      .cr-modal.open{ display:grid; }
      .cr-sheet{
        width:min(360px,92vw); background:#ffffff; border:1px solid #e6e8ec;
        border-radius:16px; padding:16px;
      }
      .cr-sheet h3{ margin-bottom:8px; }
      .cr-sheet p{ color:#5b6470; font-size:13px; line-height:1.65; margin-bottom:10px; }
      .cr-cash{
        width:100%; margin-top:8px; background:#111318; color:#fff;
        border:1px solid #111318; border-radius:999px; padding:10px; font-weight:800;
      }
      .cr-x{
        width:100%; margin-top:8px; background:none; border:0; color:#8b95a1; padding:8px;
      }
      body.gold-me .zivv-ad-sticky{ display:none !important; }
      body.gold-me{ padding-bottom: 76px !important; }
    `;
    document.head.appendChild(s);
  }

  function markGoldFeed() {
    if (!window.ZIVV_CORE) return;
    document.querySelectorAll(".post[data-id]").forEach((el) => {
      const id = el.getAttribute("data-id");
      const post = ZIVV_CORE.getPosts().find((p) => p.id === id);
      if (!post || !isGoldUser(post.user)) return;
      const ava = el.querySelector(".ava");
      if (ava) ava.classList.add("gold");
      const who = el.querySelector(".who");
      if (who && !who.querySelector(".gold-tag")) {
        who.classList.add("gold-name");
        who.insertAdjacentHTML("beforeend", '<span class="gold-tag">مميز</span>');
      }
    });
  }

  function boot() {
    wrapCore();
    injectCss();
    sweepAllGold();
    if (isGoldUser(meUser())) document.body.classList.add("gold-me");
    else document.body.classList.remove("gold-me");
    paintHome();
    paintPublish();
    setTimeout(markGoldFeed, 80);
    setTimeout(markGoldFeed, 400);
  }

  window.ZIVV_CREATOR = {
    of,
    join,
    bump,
    isIn,
    isGoldUser,
    top,
    recordView,
    progress,
    goldNeed: function () {
      return GOLD_POINTS;
    },
    myPostCount,
    openPay,
    togglePromo,
    buyWithPoints,
    buyWithCash,
    payConfig,
    savePayConfig,
    myNotes,
    pushNote,
    grantGold,
    syncLikePoints,
    likesOfUser,
    markGoldFeed,
    revokeGold(user) {
      const u = keyOf(user);
      bump(u, { gold: false, payPending: false, goldUntil: 0 });
      const list = read("zivv.goldReqs", []);
      list.forEach((x) => {
        if (x.user === u && x.status === "accepted") x.status = "revoked";
      });
      write("zivv.goldReqs", list);
      pushNote(u, {
        type: "official",
        title: "الاشتراك الذهبي",
        text: "الملك لغى اشتراكك الذهبي.",
        href: "settings.html",
      });
      return true;
    },
    goldLeft,
    goldMs: function () {
      return GOLD_MS;
    },
    expireGold,
    sweepGold,
    aiStatus,
    aiStartChat,
    aiChatLeft,
    aiUseImage,
    freeChats: function () {
      return FREE_CHATS;
    },
    freeImages: function () {
      return FREE_IMAGES;
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(wrapCore, 40);
  setTimeout(wrapCore, 180);
})();
