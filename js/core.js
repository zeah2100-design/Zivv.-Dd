(function () {
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
  (function wipeDemo() {
    if (localStorage.getItem("zivv.wipedDemo") === "2") return;
    const fake = ["layla", "karim", "omar", "maya", "nora", "youssef"];
    try {
      const feed = JSON.parse(localStorage.getItem("zivv.feed") || "[]");
      const clean = (Array.isArray(feed) ? feed : []).filter((p) => {
        const u = String((p && p.user) || "").toLowerCase();
        const id = String((p && p.id) || "");
        return fake.indexOf(u) < 0 && !/^p\d{1,2}$/.test(id);
      });
      localStorage.setItem("zivv.feed", JSON.stringify(clean));
    } catch {}
    try {
      const cr = JSON.parse(localStorage.getItem("zivv.creator") || "{}");
      fake.forEach((u) => { delete cr[u]; });
      localStorage.setItem("zivv.creator", JSON.stringify(cr));
    } catch {}
    localStorage.setItem("zivv.wipedDemo", "2");
  })();

  function pageFile() {
    return String(location.pathname.split("/").pop() || "").toLowerCase();
  }
  function isLoggedIn() {
    const s = read("zivv.session", null);
    if (!s || typeof s !== "object") return false;
    if (!s.password) return false;
    if (!(s.email || s.mark)) return false;
    if (s.email === "guest") return false;
    return true;
  }
  function requireAuth() {
    const file = pageFile();
    if (file === "index.html" || file === "" || file === "setup.html") return true;
    if (isLoggedIn() && read("zivv.session", {}).onboarding) return true;
    location.replace("index.html");
    return false;
  }
  requireAuth();

  function session() {
    return read("zivv.session", { name: "ضيف", email: "guest" });
  }
  function meKey() {
    const s = session();
    return String(s.email || s.name || "guest").toLowerCase();
  }
  function meName() {
    return session().name || "أنت";
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{N}\s@]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const PEOPLE = [];

  const MUSIC = [
    { id: "m1", title: "Nile Pulse", artist: "كريم حسن", tags: "نيل مزيج midnight" },
    { id: "m2", title: "Midnight Giza", artist: "ZIVV Lounge", tags: "أهرامات جيزة ليل" },
    { id: "m3", title: "Violet Room", artist: "نورا فؤاد", tags: "بنفسج استوديو" },
    { id: "m4", title: "Gold Hour Felucca", artist: "عمر شريف", tags: "مركب دهب نيل" },
    { id: "m5", title: "After 18", artist: "يوسف طارق", tags: "ليل مدينة" },
    { id: "m6", title: "Silk Silence", artist: "مايا نبيل", tags: "حرير موضة" },
  ];

  const SEED_POSTS = [];

  function parseTags(raw) {
    const s = String(raw || "");
    const hashes = s.match(/#[\p{L}\p{N}_]+/gu) || [];
    const parts = s
      .split(/[,،]+/)
      .map((x) => x.replace(/#/g, " ").trim())
      .join(" ")
      .split(/\s+/)
      .map((x) => x.replace(/^#/, "").trim())
      .filter(Boolean);
    const all = hashes.map((h) => h.replace(/^#/, "")).concat(parts);
    const seen = new Set();
    const out = [];
    all.forEach((t) => {
      const k = norm(t);
      if (!k || k.length < 2 || seen.has(k)) return;
      seen.add(k);
      out.push(t.replace(/^#/, ""));
    });
    return out.slice(0, 12);
  }

  const TAG_DEST = {
    reels: ["شورتس", "شريط", "ريلز", "ريل", "shorts", "reels", "reel", "short"],
    music: ["موسيقى", "مزيكا", "اغنيه", "اغنية", "أغنية", "music", "song", "صوت", "اغاني"],
    store: ["منتج", "متجر", "بيع", "تسوق", "shop", "store"],
  };

  function destLabels() {
    return { home: "الرئيسية", reels: "الشريط", music: "الموسيقى", explore: "استكشف", store: "المتجر" };
  }

  function routeDests(p) {
    const tags = (p.tags || []).map((t) => norm(t));
    const hit = (keys) => tags.some((t) => keys.some((k) => t === norm(k) || t.includes(norm(k))));
    const dests = new Set(["explore"]);
    const type = p.type || "text";
    const vk = String(p.videoKind || "");

    if (type === "video") {
      if (vk === "short") dests.add("reels");
      else dests.add("home");
    }
    if (type === "photo" || type === "text" || type === "link") dests.add("home");
    if (type === "audio") {
      dests.add("home");
      dests.add("music");
    }
    if (hit(TAG_DEST.reels) && type === "video" && vk !== "video") dests.add("reels");
    if (hit(TAG_DEST.music) || type === "audio") dests.add("music");
    if (hit(TAG_DEST.store) || type === "product") dests.add("store");
    if (type === "product") dests.delete("home");
    if (vk === "short") {
      dests.add("reels");
      dests.delete("home");
    }
    return Array.from(dests);
  }

  const BAN = [
    "استغلال اطفال",
    "جنس اطفال",
    "مواد قاصر",
    "قاصر جنس",
    "childporn",
    "child porn",
    "underage",
    "هقتلك",
    "هذبحك",
    "صنع قنبله",
    "تفجير مسجد",
    "بيع سلاح",
  ];
  const WARN = [
    "عرص",
    "شرموط",
    "متناك",
    "يا كلب",
    "يا حيوان",
    "كس ام",
    "fuck you",
    "bitch",
    "اربح مليون",
    "فوركس مضمون",
    "اضغط الرابط حالا",
  ];

  function moderate(parts) {
    const blob = norm(Array.isArray(parts) ? parts.join(" ") : parts);
    const compact = blob.replace(/\s+/g, " ");
    const hits = (list) => list.filter((w) => compact.includes(norm(w)));
    const banHits = hits(BAN);
    if (banHits.length) {
      return {
        level: "ban",
        reasons: banHits,
        note: "المنشور وحش ومخالف. اتحذف حذف نهائي ومش هينشر.",
      };
    }
    const warnHits = hits(WARN);
    if (warnHits.length) {
      return {
        level: "warn",
        reasons: warnHits,
        note: "المنشور سيء وفيه ألفاظ أو أسلوب مش مناسب. تقدر تعدّل، أو تنشر وهيظهر عليه تحذير.",
      };
    }
    return { level: "ok", reasons: [], note: "" };
  }

  function logRemoved(payload) {
    const list = read("zivv.removed", []);
    list.unshift(Object.assign({ at: Date.now() }, payload));
    write("zivv.removed", list.slice(0, 80));
  }

  const AI_MARKS = [
    "chatgpt", "gpt", "midjourney", "dalle", "dall e", "stable diffusion",
    "ذكاء اصطناعي", "الذكاء الاصطناعي", "صنع بالذكاء", "توليد بالذكاء",
    "ai generated", "generated by", "gemini", "claude", "صورة مولده", "محتوى مولد"
  ];
  const FAKE_PRODUCT = [
    "وهمي", "مزيف", "مش حقيقي", "خيال", "غير حقيقي", "fake", "scam",
    "ذكاء اصطناعي", "chatgpt", "generated", "مولد", "مش موجود", "صوره وهميه"
  ];

  function scanAI(parts) {
    const blob = norm(Array.isArray(parts) ? parts.join(" ") : parts);
    const hits = AI_MARKS.filter((w) => blob.includes(norm(w)));
    return {
      ai: hits.length > 0,
      hits,
      note: hits.length
        ? "الفلتر شايف إن المنشور مرتبط بالذكاء الاصطناعي: " + hits.slice(0, 3).join("، ")
        : "الفلتر ما شافش علامات ذكاء اصطناعي في النص."
    };
  }

  function scanProductReal(p) {
    const reasons = [];
    const title = String((p && p.title) || "").trim();
    const text = String((p && p.text) || (p && p.desc) || "").trim();
    const phone = String((p && p.phone) || "").replace(/[\s-]/g, "");
    const price = Number((p && p.price) || 0);
    if (!(p && p.image)) reasons.push("مفيش صورة حقيقية للمنتج");
    if (title.length < 3) reasons.push("اسم المنتج ناقص");
    if (text.length < 10) reasons.push("الوصف قصير — المنتج لازم يكون حقيقي وموصوف");
    if (!(price > 0)) reasons.push("السعر مش منطقي لمنتج حقيقي");
    if (!/^(01[0125][0-9]{8}|\+?201[0125][0-9]{8})$/.test(phone)) {
      reasons.push("رقم التواصل مش رقم مصري صحيح");
    }
    const blob = norm(title + " " + text + " " + ((p && p.specs) || []).join(" "));
    const fakeHits = FAKE_PRODUCT.filter((w) => blob.includes(norm(w)));
    if (fakeHits.length) reasons.push("الفلتر شايف المنتج مش حقيقي: " + fakeHits.join("، "));
    if (scanAI([title, text]).ai) reasons.push("المنتج لازم يكون حقيقي — ممنوع منتج معمول بالذكاء الاصطناعي");
    return {
      real: reasons.length === 0,
      reasons,
      note: reasons.length
        ? "المنتج اترفض لأنه مش ثابت إنه حقيقي: " + reasons.join(" · ")
        : "الفلتر اعتبر المنتج حقيقي."
    };
  }

  function reviewPost(partial) {
    const fromField = Array.isArray(partial.tags) ? partial.tags.join(" ") : partial.tags || "";
    const fromText = (String(partial.text || "").match(/#[\p{L}\p{N}_]+/gu) || []).join(" ");
    const tags = parseTags(fromField + " " + fromText);
    const scan = moderate([partial.title, partial.text, tags.join(" "), partial.link, partial.place]);
    const dests = routeDests(Object.assign({}, partial, { tags }));
    const aiScan = scanAI([partial.title, partial.text, tags.join(" ")]);
    const productScan = (partial.type === "product") ? scanProductReal(partial) : null;
    return { tags, dests, scan, aiScan, productScan };
  }

  function bannedUsers() {
    return read("zivv.banned", []).map((u) => String(u || "").replace(/^@/, "").toLowerCase());
  }
  function isBanned(user) {
    const u = String(user || "").replace(/^@/, "").toLowerCase();
    return !!u && bannedUsers().indexOf(u) >= 0;
  }
  function banUser(user, note) {
    const u = String(user || "").replace(/^@/, "").toLowerCase();
    if (!u) return false;
    const list = bannedUsers();
    if (list.indexOf(u) < 0) {
      list.unshift(u);
      write("zivv.banned", list);
    }
    const reports = read("zivv.reports", []);
    reports.unshift({
      id: "r_ban_" + Date.now(),
      type: "account-block",
      dest: "king",
      targetUser: u,
      note: note || "حظر حساب من الملك",
      at: Date.now(),
    });
    write("zivv.reports", reports);
    return true;
  }
  function unbanUser(user) {
    const u = String(user || "").replace(/^@/, "").toLowerCase();
    write("zivv.banned", bannedUsers().filter((x) => x !== u));
    return true;
  }
  function blockPost(postId) {
    let live = read("zivv.feed", []);
    if (!live.length) live = [];
    const p = live.find((x) => x.id === postId);
    if (p) p.status = "removed";
    write("zivv.feed", live);
    logRemoved({ id: postId, note: "حظر منشور من الملك", at: Date.now() });
    return true;
  }
  function getPosts() {
    const live = read("zivv.feed", []);
    const list = live.length ? live : [];
    const banned = bannedUsers();
    return list.filter((p) => p && p.status !== "removed" && banned.indexOf(String(p.user || "").toLowerCase()) < 0);
  }
  function allPostsRaw() {
    const live = read("zivv.feed", []);
    return live.length ? live.slice() : [];
  }

  function postsFor(dest) {
    return getPosts().filter((p) => {
      if (!p || p.status === "removed") return false;
      if (dest === "explore") return true;
      if (dest === "reels") {
        return p.videoKind === "short" || (p.type === "video" && (p.dests || []).includes("reels")) || (!p.dests && p.type === "video" && p.videoKind !== "video");
      }
      if (dest === "home") {
        if (p.videoKind === "short") return false;
        if (p.type === "video") return p.videoKind !== "short";
        const d = p.dests;
        if (!d || !d.length) return true;
        return d.includes("home");
      }
      if (dest === "music") return p.type === "audio" || (p.dests || []).includes("music");
      const d = p.dests;
      if (!d || !d.length) return true;
      return d.includes(dest);
    });
  }

  function author() {
    const s = session();
    const user = String(s.username || (s.email || "me").split("@")[0] || "me").replace(/^@/, "");
    let avatar = "brand/logo-sm.png";
    let name = s.name || "أنت";
    try {
      const map = read("zivv.profiles", {});
      const p = map[user.toLowerCase()] || {};
      if (p.avatar) avatar = p.avatar;
      if (p.name) name = p.name;
    } catch {}
    return { name, user, avatar };
  }

  function rememberTags(tags) {
    const cur = read("zivv.tagAffinity", []);
    const seen = new Set(cur.map((t) => norm(t)));
    (tags || []).forEach((t) => {
      const k = norm(t);
      if (!k || seen.has(k)) return;
      seen.add(k);
      cur.unshift(String(t).replace(/^#/, ""));
    });
    write("zivv.tagAffinity", cur.slice(0, 48));
  }

  function userTags() {
    const set = new Set();
    read("zivv.tagAffinity", []).forEach((t) => set.add(norm(t)));
    const me = meUser();
    getPosts().forEach((p) => {
      const mine = String(p.user || "").toLowerCase() === me || likedByMe(p.id);
      if (!mine) return;
      (p.tags || []).forEach((t) => set.add(norm(t)));
    });
    if (!set.size) {
      const count = {};
      getPosts().forEach((p) => {
        (p.tags || []).forEach((t) => {
          const k = norm(t);
          if (k) count[k] = (count[k] || 0) + 1;
        });
      });
      Object.keys(count)
        .sort((a, b) => count[b] - count[a])
        .slice(0, 6)
        .forEach((k) => set.add(k));
    }
    return set;
  }

  function allHashtags() {
    const map = new Map();
    getPosts().forEach((p) => {
      (p.tags || []).forEach((t) => {
        const raw = String(t || "").replace(/^#/, "");
        const k = norm(raw);
        if (!k) return;
        const cur = map.get(k) || { tag: raw, count: 0, posts: [] };
        cur.count += 1;
        if (cur.posts.length < 8) cur.posts.push(p);
        map.set(k, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  function addPost(partial) {
    const a = author();
    const review = reviewPost(partial || {});
    if ((partial || {}).type === "product") {
      const productScan = scanProductReal(partial);
      if (!productScan.real) {
        return { blocked: true, level: "ban", reasons: productScan.reasons, note: productScan.note };
      }
    }
    if (review.scan.level === "ban") {
      logRemoved({
        title: (partial && partial.title) || "",
        text: (partial && partial.text) || "",
        user: a.user,
        reasons: review.scan.reasons,
        note: review.scan.note,
      });
      return { blocked: true, level: "ban", reasons: review.scan.reasons, note: review.scan.note };
    }
    const forced = Object.assign({}, partial || {}, { tags: review.tags });
    if (forced.type === "video") {
      if (forced.videoKind === "short") forced.dests = ["explore", "reels"];
      else {
        forced.videoKind = forced.videoKind || "video";
        forced.dests = ["explore", "home"];
      }
    }
    const post = Object.assign(
      {
        id: "p" + Date.now(),
        name: a.name,
        user: a.user,
        avatar: a.avatar,
        time: "الآن",
        text: "",
        title: "",
        tags: [],
        dests: [],
        likes: 0,
        comments: [],
        following: true,
        ai: false,
        type: "text",
        status: "ok",
      },
      forced,
      {
        tags: review.tags,
        dests: forced.dests && forced.dests.length ? forced.dests : review.dests,
        status: review.scan.level === "warn" ? "warned" : "ok",
        warnNote: review.scan.level === "warn" ? review.scan.note : "",
      }
    );
    if (post.type === "video") {
      if (post.videoKind === "short") post.dests = ["reels", "explore"];
      else post.dests = ["home", "explore"];
    }
    const posts = getPosts();
    posts.unshift(post);
    try {
      write("zivv.feed", posts);
    } catch (err) {
      const slim = posts.map((p) => {
        const copy = Object.assign({}, p);
        if (copy.image && String(copy.image).length > 80000) copy.image = "";
        return copy;
      });
      write("zivv.feed", slim);
    }
    rememberTags(post.tags);
    return post;
  }

  function likesMap() {
    return read("zivv.likes", {});
  }
  function commentsMap() {
    return read("zivv.comments", {});
  }

  function likers(postId) {
    return likesMap()[postId] || [];
  }
  function likedByMe(postId) {
    return likers(postId).includes(meKey());
  }
  function likeCount(post) {
    return (Number(post.likes) || 0) + likers(post.id).length;
  }
  function toggleLike(postId) {
    const all = likesMap();
    const list = all[postId] ? all[postId].slice() : [];
    const i = list.indexOf(meKey());
    if (i >= 0) list.splice(i, 1);
    else list.push(meKey());
    all[postId] = list;
    write("zivv.likes", all);
    if (list.includes(meKey())) {
      const post = getPosts().find((p) => p.id === postId);
      if (post) rememberTags(post.tags);
    }
    return list.includes(meKey());
  }

  function commentsOf(post) {
    const extra = commentsMap()[post.id] || [];
    return (post.comments || []).concat(extra).map((c, i) =>
      Object.assign({ id: c.id || "old_" + i, parentId: c.parentId || null, at: c.at || 0 }, c)
    );
  }
  function addComment(postId, text, parentId) {
    const all = commentsMap();
    const list = all[postId] ? all[postId].slice() : [];
    list.push({
      id: "c_" + Date.now(),
      name: meName(),
      by: meKey(),
      text,
      at: Date.now(),
      parentId: parentId || null,
    });
    all[postId] = list;
    write("zivv.comments", all);
    return list;
  }

  function clikes() {
    return read("zivv.commentLikes", {});
  }
  function commentLikeKey(postId, cid) {
    return postId + ":" + cid;
  }
  function commentLiked(postId, cid) {
    return (clikes()[commentLikeKey(postId, cid)] || []).includes(meKey());
  }
  function commentLikeCount(postId, cid) {
    return (clikes()[commentLikeKey(postId, cid)] || []).length;
  }
  function toggleCommentLike(postId, cid) {
    const all = clikes();
    const k = commentLikeKey(postId, cid);
    const list = all[k] ? all[k].slice() : [];
    const i = list.indexOf(meKey());
    if (i >= 0) list.splice(i, 1);
    else list.push(meKey());
    all[k] = list;
    write("zivv.commentLikes", all);
    return list.includes(meKey());
  }

  function shareCount(postId) {
    return read("zivv.shares", []).filter((s) => s.postId === postId).length;
  }

  function peopleForShare() {
    const map = new Map();
    PEOPLE.forEach((p) => map.set(p.user, p));
    read("zivv.followUsers", []).forEach((u) => {
      if (map.has(u)) return;
      const p = read("zivv.profiles", {})[u] || {};
      map.set(u, { name: p.name || u, user: u, avatar: p.avatar || "brand/logo-sm.png" });
    });
    Object.keys(read("zivv.chats", {})).forEach((u) => {
      if (!map.has(u)) map.set(u, { name: u, user: u, avatar: "brand/logo-sm.png" });
    });
    Object.keys(read("zivv.privateChats", {})).forEach((u) => {
      if (!map.has(u)) map.set(u, { name: u, user: u, avatar: "brand/logo-sm.png" });
    });
    read("zivv.chatFriends", []).forEach((u) => {
      if (!map.has(u)) {
        const p = read("zivv.profiles", {})[u] || {};
        map.set(u, { name: p.name || u, user: u, avatar: p.avatar || "brand/logo-sm.png" });
      }
    });
    return Array.from(map.values());
  }

  function chatKey(priv) {
    return priv ? "zivv.privateChats" : "zivv.chats";
  }

  function sendMessage(toUser, payload, priv) {
    const key = chatKey(priv);
    const chats = read(key, {});
    const thread = chats[toUser] || [];
    const msg = Object.assign(
      {
        id: "m_" + Date.now(),
        from: meKey(),
        fromUser: author().user,
        name: meName(),
        kind: "text",
        text: "",
        at: Date.now(),
        priv: !!priv,
      },
      payload || {}
    );
    thread.push(msg);
    chats[toUser] = thread;
    write(key, chats);
    return msg;
  }

  function threadWith(user, priv) {
    return read(chatKey(priv), {})[user] || [];
  }

  function inbox(priv) {
    const chats = read(chatKey(priv), {});
    const people = peopleForShare();
    return Object.keys(chats)
      .map((user) => {
        const thread = chats[user] || [];
        const last = thread[thread.length - 1] || {};
        const person = people.find((p) => p.user === user) || { name: user, user, avatar: "brand/logo-sm.png" };
        return { user, person, last, count: thread.length };
      })
      .sort((a, b) => (b.last.at || 0) - (a.last.at || 0));
  }

  function meUser() {
    return String(author().user || "").replace(/^@/, "").toLowerCase();
  }

  function followGraph() {
    let g = read("zivv.followGraph", null);
    if (!g || typeof g !== "object") {
      g = {};
      const old = read("zivv.followUsers", []);
      if (Array.isArray(old) && old.length) {
        g[meUser()] = old.map((u) => String(u).replace(/^@/, "").toLowerCase());
      }
      write("zivv.followGraph", g);
    }
    return g;
  }
  function saveFollowGraph(g) {
    write("zivv.followGraph", g);
    const me = meUser();
    if (me && g[me]) write("zivv.followUsers", g[me]);
  }
  function followingOf(user) {
    const u = String(user || meUser() || "").replace(/^@/, "").toLowerCase();
    return (followGraph()[u] || []).map((x) => String(x).replace(/^@/, "").toLowerCase());
  }
  function followersOf(user) {
    const u = String(user || meUser() || "").replace(/^@/, "").toLowerCase();
    const g = followGraph();
    return Object.keys(g).filter((k) =>
      (g[k] || []).some((x) => String(x).replace(/^@/, "").toLowerCase() === u)
    );
  }
  function isFollowing(user) {
    return followingOf(meUser()).indexOf(String(user || "").replace(/^@/, "").toLowerCase()) >= 0;
  }
  function followUser(user) {
    const me = meUser();
    const t = String(user || "").replace(/^@/, "").toLowerCase();
    if (!me || !t || me === t) return false;
    const g = followGraph();
    const list = followingOf(me);
    if (list.indexOf(t) < 0) list.push(t);
    g[me] = list;
    saveFollowGraph(g);
    return true;
  }
  function unfollowUser(user) {
    const me = meUser();
    const t = String(user || "").replace(/^@/, "").toLowerCase();
    const g = followGraph();
    g[me] = followingOf(me).filter((x) => x !== t);
    saveFollowGraph(g);
    return true;
  }
  function followerCount(user) {
    return followersOf(user).length;
  }
  function followingCount(user) {
    return followingOf(user).length;
  }
  function receivedLikes(user) {
    const u = String(user || meUser() || "").replace(/^@/, "").toLowerCase();
    return getPosts()
      .filter((p) => String(p.user || "").toLowerCase() === u)
      .reduce((s, p) => s + likeCount(p), 0);
  }
  function receivedComments(user) {
    const u = String(user || meUser() || "").replace(/^@/, "").toLowerCase();
    return getPosts()
      .filter((p) => String(p.user || "").toLowerCase() === u)
      .reduce((s, p) => s + commentsOf(p).length, 0);
  }
  function kingOwner() {
    try {
      return JSON.parse(localStorage.getItem("zivv.kingOwner") || "null");
    } catch {
      return null;
    }
  }
  function isKingUser(user) {
    const k = kingOwner();
    if (!k) return false;
    const u = String(user || meUser() || "").replace(/^@/, "").toLowerCase();
    return !!(u && u === String(k.user || "").toLowerCase());
  }
  function claimKing() {
    const cur = kingOwner();
    if (cur && cur.user) return cur;
    const a = author();
    const s = session();
    const owner = {
      user: a.user,
      email: s.email || "",
      name: a.name || s.name || a.user,
      at: Date.now(),
    };
    localStorage.setItem("zivv.kingOwner", JSON.stringify(owner));
    return owner;
  }

  function friendReqs() {
    return read("zivv.friendReqs", []);
  }
  function saveFriendReqs(list) {
    write("zivv.friendReqs", list);
  }
  function areFriends(a, b) {
    const ua = String(a || "").replace(/^@/, "").toLowerCase();
    const ub = String(b || "").replace(/^@/, "").toLowerCase();
    if (!ua || !ub || ua === ub) return false;
    return friendReqs().some(
      (r) =>
        r.status === "accepted" &&
        ((r.from === ua && r.to === ub) || (r.from === ub && r.to === ua))
    );
  }
  function friendStatus(target) {
    const me = meUser();
    const t = String(target || "").replace(/^@/, "").toLowerCase();
    const r = friendReqs().find(
      (x) => (x.from === me && x.to === t) || (x.from === t && x.to === me)
    );
    if (!r) return "none";
    if (r.status === "accepted") return "friends";
    if (r.status === "rejected") return "none";
    if (r.from === me) return "outgoing";
    return "incoming";
  }
  function sendFriendRequest(toUser, toName) {
    const me = meUser();
    const to = String(toUser || "").replace(/^@/, "").toLowerCase();
    if (!to || to === me) return null;
    if (areFriends(me, to) || friendStatus(to) !== "none") return friendStatus(to);
    const list = friendReqs();
    list.unshift({
      id: "fr_" + Date.now(),
      from: me,
      fromName: meName(),
      to,
      toName: toName || to,
      status: "pending",
      at: Date.now(),
    });
    saveFriendReqs(list);
    return "outgoing";
  }
  function setFriendRequest(id, status) {
    const list = friendReqs();
    const r = list.find((x) => x.id === id);
    if (r) r.status = status;
    saveFriendReqs(list);
    return r || null;
  }
  function incomingFriendRequests() {
    const me = meUser();
    return friendReqs().filter((r) => r.to === me && r.status === "pending");
  }
  function myFriends() {
    const me = meUser();
    const out = [];
    friendReqs().forEach((r) => {
      if (r.status !== "accepted") return;
      if (r.from === me) out.push(r.to);
      else if (r.to === me) out.push(r.from);
    });
    return out;
  }
  function chatFriends() {
    return myFriends();
  }
  function addChatFriend(user) {
    return areFriends(meUser(), user);
  }
  function isChatFriend(user) {
    return areFriends(meUser(), user);
  }

  function goldReqs() {
    return read("zivv.goldReqs", []);
  }
  function goldStatus(user) {
    const u = String(user || meUser()).replace(/^@/, "").toLowerCase();
    const list = goldReqs();
    if (list.some((x) => x.user === u && x.status === "accepted")) return "gold";
    if (list.some((x) => x.user === u && x.status === "pending")) return "pending";
    return "none";
  }
  function isGold(user) {
    return goldStatus(user) === "gold";
  }
  function requestGold() {
    const u = meUser();
    const st = goldStatus(u);
    if (st !== "none") return st;
    const list = goldReqs();
    list.unshift({
      id: "g_" + Date.now(),
      user: u,
      name: meName(),
      status: "pending",
      dest: "king",
      note: "طلب اشتراك ذهبي — الملك يقبل أو يرفض",
      at: Date.now(),
    });
    write("zivv.goldReqs", list);
    const reports = read("zivv.reports", []);
    reports.unshift({
      id: "r_gold_" + Date.now(),
      type: "gold",
      dest: "king",
      targetUser: u,
      targetName: meName(),
      reporterName: meName(),
      reporterEmail: meKey(),
      note: "طلب اشتراك ذهبي",
      at: Date.now(),
    });
    write("zivv.reports", reports);
    return "pending";
  }
  function setGold(id, status) {
    const list = goldReqs();
    const r = list.find((x) => x.id === id);
    if (r) r.status = status;
    write("zivv.goldReqs", list);
    return r || null;
  }
  function searchPeople(query) {
    const q = String(query || "").trim();
    const list = peopleForShare();
    if (!q) return list.slice();
    return list
      .map((p) => ({
        p,
        s: Math.max(score(p.name, q), score(p.user, q), score("@" + p.user, q), score(p.city, q)),
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
  }

  function reportPost(post, note) {
    const reports = read("zivv.reports", []);
    reports.unshift({
      id: "r_" + Date.now(),
      postId: post.id,
      postAuthor: post.name,
      postUser: post.user,
      postText: post.text,
      reporterName: meName(),
      reporterEmail: meKey(),
      note: note || "مخالفة لقوانين الموقع",
      at: Date.now(),
      dest: "king",
    });
    write("zivv.reports", reports);
    return reports[0];
  }

  function sharePost(post, toUser) {
    const shares = read("zivv.shares", []);
    shares.unshift({
      id: "sh_" + Date.now(),
      postId: post.id,
      from: meKey(),
      fromName: meName(),
      to: toUser,
      preview: post.text,
      at: Date.now(),
    });
    write("zivv.shares", shares);
    const chats = read("zivv.chats", {});
    const thread = chats[toUser] || [];
    thread.push({
      from: meKey(),
      name: meName(),
      text: "شارك منشور: " + (post.text || "").slice(0, 80),
      postId: post.id,
      at: Date.now(),
    });
    chats[toUser] = thread;
    write("zivv.chats", chats);
    sendMessage(toUser, {
      kind: "share",
      text: "شارك منشور: " + ((post.title || post.text || "").slice(0, 80)),
      postId: post.id,
      preview: post.text || post.title || "",
      image: post.image || "",
    });
    return true;
  }

  function score(hay, q) {
    const h = norm(hay);
    const n = norm(q);
    if (!n) return 0;
    if (h === n) return 100;
    if (h.startsWith(n)) return 80;
    if (h.includes(n)) return 60;
    const parts = n.split(" ").filter(Boolean);
    if (parts.length && parts.every((p) => h.includes(p))) return 40;
    return 0;
  }

  function isPhotoPost(p) {
    return p && (p.type === "photo" || (!!p.image && p.type !== "video" && p.type !== "product" && !p.videoId));
  }
  function isVideoPost(p) {
    return p && (p.type === "video" || !!p.videoId || p.videoKind === "short" || p.videoKind === "video");
  }

  function search(query, kind) {
    const q = String(query || "").trim();
    const qn = norm(q.replace(/^#/, ""));
    const people = PEOPLE.map((p) => ({
      kind: "person",
      score: Math.max(score(p.name, q), score(p.user, q), score("@" + p.user, q), score(p.city, q)),
      item: p,
    })).filter((x) => x.score > 0);

    const posts = getPosts().map((p) => {
      const tagScore = Math.max.apply(null, [0].concat((p.tags || []).map((t) => score(t, q.replace(/^#/, "")))));
      return {
        kind: "post",
        score: Math.max(
          score(p.text, q),
          score(p.title, q),
          score((p.tags || []).join(" "), q.replace(/^#/, "")),
          tagScore,
          score(p.name, q),
          score(p.user, q)
        ),
        item: p,
      };
    }).filter((x) => x.score > 0);

    const photos = posts
      .filter((x) => isPhotoPost(x.item))
      .map((x) => Object.assign({}, x, { kind: "photo" }));
    const videos = posts
      .filter((x) => isVideoPost(x.item))
      .map((x) => Object.assign({}, x, { kind: "video" }));

    const music = MUSIC.map((m) => ({
      kind: "music",
      score: Math.max(score(m.title, q), score(m.artist, q), score(m.tags, q)),
      item: m,
    })).filter((x) => x.score > 0);

    const catalog = (window.ZIVV_STORE && ZIVV_STORE.allProducts && ZIVV_STORE.allProducts()) || [];
    const products = catalog.map((p) => ({
      kind: "product",
      score: Math.max(
        score(p.title, q),
        score(p.seller, q),
        score(p.sellerUser, q),
        score(p.desc || p.description, q),
        score(p.cat, q),
        score((p.specs || []).join(" "), q),
        score(String(p.price || ""), q)
      ),
      item: p,
    })).filter((x) => x.score > 0);

    const hashes = allHashtags()
      .map((h) => ({
        kind: "hashtag",
        score: qn ? score(h.tag, qn) : 50 + Math.min(40, h.count),
        item: h,
      }))
      .filter((x) => (qn ? x.score > 0 : true));

    const at = q.startsWith("@");
    const hashQ = q.startsWith("#");
    let bag = [];
    if (kind === "person" || at) bag = people;
    else if (kind === "post") bag = posts;
    else if (kind === "photo") bag = q ? photos : getPosts().filter(isPhotoPost).map((p) => ({ kind: "photo", score: 40, item: p }));
    else if (kind === "video") bag = q ? videos : getPosts().filter(isVideoPost).map((p) => ({ kind: "video", score: 40, item: p }));
    else if (kind === "music") bag = music;
    else if (kind === "product") bag = q ? products : catalog.map((p) => ({ kind: "product", score: 40, item: p }));
    else if (kind === "hashtag" || hashQ) {
      if (qn) {
        const tagHits = hashes.filter((h) => h.score > 0);
        const taggedPosts = getPosts()
          .filter((p) => (p.tags || []).some((t) => norm(t) === qn || norm(t).includes(qn)))
          .map((p) => ({ kind: "post", score: 70, item: p }));
        bag = tagHits.concat(taggedPosts);
      } else bag = hashes;
    } else {
      bag = people.concat(photos, videos, posts, music, products, hashes);
      if (at) bag = people;
    }
    bag.sort((a, b) => b.score - a.score);
    return bag;
  }

  window.ZIVV_CORE = {
    session,
    meKey,
    meName,
    norm,
    PEOPLE,
    MUSIC,
    getPosts,
    postsFor,
    parseTags,
    routeDests,
    destLabels,
    moderate,
    scanAI,
    scanProductReal,
    reviewPost,
    author,
    addPost,
    likedByMe,
    likeCount,
    toggleLike,
    commentsOf,
    addComment,
    commentLiked,
    commentLikeCount,
    toggleCommentLike,
    shareCount,
    peopleForShare,
    sendMessage,
    threadWith,
    inbox,
    chatFriends,
    addChatFriend,
    isChatFriend,
    areFriends,
    friendStatus,
    sendFriendRequest,
    setFriendRequest,
    incomingFriendRequests,
    myFriends,
    goldStatus,
    isGold,
    requestGold,
    setGold,
    goldReqs,
    bannedUsers,
    isBanned,
    banUser,
    unbanUser,
    blockPost,
    allPostsRaw,
    searchPeople,
    reportPost,
    sharePost,
    search,
    saveFile,
    downloadPost,
    isLoggedIn,
    requireAuth,
    followUser,
    unfollowUser,
    isFollowing,
    followersOf,
    followingOf,
    followerCount,
    followingCount,
    receivedLikes,
    receivedComments,
    kingOwner,
    isKingUser,
    claimKing,
  };

  function saveFile(href, filename) {
    if (!href) return false;
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "zivv-file";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  async function blobFromSrc(src) {
    if (!src) return null;
    if (src.startsWith("data:")) {
      const m = src.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return null;
      const bin = atob(m[2]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: m[1] || "application/octet-stream" });
    }
    if (src.startsWith("blob:")) {
      try {
        const r = await fetch(src);
        return await r.blob();
      } catch {
        return null;
      }
    }
    try {
      const r = await fetch(src);
      if (r.ok) return await r.blob();
    } catch {}
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = src;
      });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const data = c.toDataURL("image/jpeg", 0.92);
      return blobFromSrc(data);
    } catch {}
    return null;
  }

  async function downloadPost(post) {
    if (!post) return false;
    const base = "zivv-" + String(post.id || Date.now()).replace(/[^\w.-]+/g, "_");
    if (post.videoId && window.ZIVV_MEDIA && ZIVV_MEDIA.get) {
      const blob = await ZIVV_MEDIA.get(post.videoId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        saveFile(url, base + (blob.type && blob.type.indexOf("webm") >= 0 ? ".webm" : ".mp4"));
        return true;
      }
    }
    if (post.audioId && window.ZIVV_MEDIA && ZIVV_MEDIA.get) {
      const blob = await ZIVV_MEDIA.get(post.audioId);
      if (blob) {
        saveFile(URL.createObjectURL(blob), base + ".mp3");
        return true;
      }
    }
    const mediaEl = document.querySelector('[data-id="' + post.id + '"] video, [data-id="' + post.id + '"] img.pic, [data-id="' + post.id + '"] img.bg');
    if (mediaEl && mediaEl.src && (mediaEl.src.startsWith("blob:") || mediaEl.src.startsWith("data:"))) {
      const blob = await blobFromSrc(mediaEl.src);
      if (blob) {
        const ext = (blob.type || "").indexOf("video") >= 0 ? ".mp4" : ".jpg";
        saveFile(URL.createObjectURL(blob), base + ext);
        return true;
      }
    }
    if (post.image) {
      const blob = await blobFromSrc(post.image);
      if (blob) {
        const ext = (blob.type || "").indexOf("png") >= 0 ? ".png" : ".jpg";
        saveFile(URL.createObjectURL(blob), base + ext);
        return true;
      }
      saveFile(post.image, base + ".jpg");
      return true;
    }
    if (post.audio) {
      saveFile(post.audio, base + ".mp3");
      return true;
    }
    const body = [post.title || "", post.text || "", (post.tags || []).map((t) => "#" + t).join(" ")].filter(Boolean).join("\n");
    const blob = new Blob([body || "منشور ZIVV"], { type: "text/plain;charset=utf-8" });
    saveFile(URL.createObjectURL(blob), base + ".txt");
    return true;
  }
})();
