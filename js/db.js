// ZIVV Real Database Client v2 - supports Supabase + SQLite + API
(function () {
  // Keep epoch wipe but preserve important keys
  (function wipeSite() {
    const EPOCH = "wipe-20260826-realdb";
    try {
      if (localStorage.getItem("zivv.epoch") === EPOCH) return;
      const keepLang = localStorage.getItem("zivv.lang");
      const keepSb = localStorage.getItem("zivv.supabase");
      const keepKing = localStorage.getItem("zivv.kingPass");
      const keepSession = localStorage.getItem("zivv.session");
      const keepUsers = localStorage.getItem("zivv.users");
      localStorage.clear();
      if (keepLang) localStorage.setItem("zivv.lang", keepLang);
      if (keepSb) localStorage.setItem("zivv.supabase", keepSb);
      if (keepKing) localStorage.setItem("zivv.kingPass", keepKing);
      if (keepSession) localStorage.setItem("zivv.session", keepSession);
      if (keepUsers) localStorage.setItem("zivv.users", keepUsers);
      localStorage.setItem("zivv.epoch", EPOCH);
      try { sessionStorage.clear(); } catch {}
    } catch {}
  })();

  let mode = "local";
  let ready = false;
  const waiters = [];
  let lastPull = 0;
  let realDbInfo = null;

  function done() {
    ready = true;
    waiters.splice(0).forEach((fn) => fn(mode));
  }
  function whenReady(fn) {
    if (ready) fn(mode);
    else waiters.push(fn);
  }
  function readLS(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function writeLS(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
  function cfg() {
    const c = window.ZIVV_SUPABASE_CFG || {};
    let url = String(c.url || "").trim().replace(/\/$/, "");
    let anon = String(c.anon || "").trim();
    if (!url || !anon) {
      try {
        const s = JSON.parse(localStorage.getItem("zivv.supabase") || "null") || {};
        url = String(s.url || "").trim().replace(/\/$/, "");
        anon = String(s.anon || "").trim();
      } catch {}
    }
    return { url, anon };
  }
  function live() { return mode === "supabase" && cfg().url && cfg().anon; }
  function remote() { return mode === "api" || mode === "real" || live(); }

  let writeChain = Promise.resolve();
  function enqueueWrite(fn) {
    const run = writeChain.then(fn, fn);
    writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  async function api(method, path, body) {
    const go = async () => {
      const opt = { method, headers: { "Content-Type": "application/json" } };
      if (body) opt.body = JSON.stringify(body);
      const r = await fetch(path, opt);
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!r.ok) throw new Error((data && data.error) || text || ("HTTP " + r.status));
      return data;
    };
    if (String(method || "GET").toUpperCase() === "GET") return go();
    return enqueueWrite(go);
  }

  async function sb(path, opt) {
    const { url, anon } = cfg();
    if (!url || !anon) throw new Error("no supabase");
    opt = opt || {};
    const headers = Object.assign({
      apikey: anon,
      "Content-Type": "application/json",
      Prefer: opt.prefer || "return=representation"
    }, opt.headers || {});
    if (anon.indexOf("sb_") !== 0) headers.Authorization = "Bearer " + anon;
    const r = await fetch(url + "/rest/v1/" + path, {
      method: opt.method || "GET",
      headers,
      body: opt.body ? JSON.stringify(opt.body) : undefined
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) throw new Error((data && data.message) || text || ("HTTP " + r.status));
    return data;
  }

  async function ping() {
    const row = await sb("posts?select=id&limit=1");
    return Array.isArray(row);
  }

  function isRemote(s) {
    const v = String(s || "");
    return /^(https?:|brand\/|posts\/|avatars\/|uploads\/)/i.test(v);
  }
  function slimMedia(s) {
    const v = String(s || "");
    if (v.startsWith("data:") && v.length > 4000) return "";
    return v;
  }
  function blobToData(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  async function uploadMedia(src, name, mime) {
    if (!src) return "";
    if (isRemote(src)) return src;
    let data = src;
    let type = mime || "";
    try {
      if (typeof Blob !== "undefined" && src instanceof Blob) {
        type = src.type || type || "application/octet-stream";
        data = await blobToData(src);
      }
    } catch {}
    const s = String(data || "");
    if (!s || (!s.startsWith("data:") && s.length < 40)) return slimMedia(s);
    if (mode !== "api" && mode !== "real" && !live()) return slimMedia(s);
    try {
      const r = await api("POST", "/api/upload", { name: name || "file", mime: type, data: s });
      return (r && r.url) || slimMedia(s);
    } catch { return slimMedia(s); }
  }

  async function materializePost(p) {
    if (!p) return p;
    const out = Object.assign({}, p);
    if (out.image && !isRemote(out.image)) {
      const u = await uploadMedia(out.image, (out.id || "p") + "-img");
      if (u) out.image = u;
    }
    if (out.avatar && !isRemote(out.avatar)) {
      const u = await uploadMedia(out.avatar, String(out.user || "u") + "-ava");
      if (u) out.avatar = u;
    }
    if (out.videoId && !isRemote(out.videoId) && window.ZIVV_MEDIA && ZIVV_MEDIA.get) {
      try {
        const blob = await ZIVV_MEDIA.get(out.videoId);
        if (blob) {
          const u = await uploadMedia(blob, (out.id || "p") + "-vid", blob.type);
          if (u) out.videoId = u;
        }
      } catch {}
    }
    if (out.audioId && !isRemote(out.audioId) && window.ZIVV_MEDIA && ZIVV_MEDIA.get) {
      try {
        const blob = await ZIVV_MEDIA.get(out.audioId);
        if (blob) {
          const u = await uploadMedia(blob, (out.id || "p") + "-aud", blob.type);
          if (u) out.audioId = u;
        }
      } catch {}
    }
    return out;
  }

  function toRemotePost(p) {
    return {
      id: p.id,
      username: p.user || "",
      name: p.name || "",
      avatar: slimMedia(p.avatar),
      title: p.title || "",
      body: p.text || "",
      type: p.type || "text",
      video_kind: p.videoKind || "",
      tags: p.tags || [],
      dests: p.dests || [],
      image_url: slimMedia(p.image),
      video_url: p.videoId || "",
      audio_url: p.audioId || "",
      sound_url: p.soundId || "",
      mute_original: !!p.muteOriginal,
      link: p.link || "",
      place: p.place || "",
      status: p.status || "ok",
      visibility: p.visibility || "",
      priv: !!p.priv,
      created_at: p.created_at || new Date().toISOString()
    };
  }

  function fromRemotePost(r) {
    return {
      id: r.id,
      name: r.name,
      user: r.username || r.user,
      avatar: r.avatar || r.image_url || "brand/logo-sm.png",
      title: r.title || "",
      text: r.body || r.text || "",
      type: r.type || "text",
      videoKind: r.video_kind || r.videoKind || "",
      tags: r.tags || [],
      dests: r.dests || [],
      image: r.image_url || r.image || "",
      videoId: r.video_url || r.videoId || "",
      audioId: r.audio_url || r.audioId || "",
      soundId: r.sound_url || r.soundId || "",
      muteOriginal: !!(r.mute_original || r.muteOriginal),
      link: r.link || "",
      place: r.place || "",
      status: r.status || "ok",
      visibility: r.visibility || "",
      priv: !!r.priv,
      time: "الآن",
      likes: r.likes_count || 0,
      comments: [],
      following: true,
      ai: false,
      created_at: r.created_at
    };
  }

  function mergeFeed(mapped) {
    const local = readLS("zivv.feed", []);
    const by = {};
    local.forEach((x) => { if (x && x.id) by[x.id] = x; });
    mapped.forEach((p) => {
      const L = by[p.id];
      if (!L) return;
      if (!p.image && L.image) p.image = L.image;
      if ((!p.avatar || p.avatar === "brand/logo-sm.png") && L.avatar) p.avatar = L.avatar;
      if (!p.videoId && L.videoId) p.videoId = L.videoId;
      if (!p.audioId && L.audioId) p.audioId = L.audioId;
      if (L.promoted) p.promoted = true;
      delete by[p.id];
    });
    Object.keys(by).forEach((id) => {
      const L = by[id];
      if (!L || L.status === "removed" || L.blocked) return;
      mapped.unshift(L);
    });
    writeLS("zivv.feed", mapped);
    return mapped.length;
  }

  function mergeLikes(remoteList) {
    const map = {};
    (remoteList || []).forEach((x) => {
      if (!x.post_id || !x.user_key) return;
      map[x.post_id] = map[x.post_id] || [];
      if (map[x.post_id].indexOf(x.user_key) < 0) map[x.post_id].push(x.user_key);
    });
    let me = "";
    try { me = (window.ZIVV_CORE && ZIVV_CORE.meKey && ZIVV_CORE.meKey()) || ""; } catch {}
    const local = readLS("zivv.likes", {});
    if (me) {
      Object.keys(local).forEach((pid) => {
        const had = (local[pid] || []).indexOf(me) >= 0;
        const rem = (map[pid] || []).indexOf(me) >= 0;
        if (had && !rem) {
          map[pid] = map[pid] || [];
          map[pid].push(me);
        }
        if (!had && rem) map[pid] = (map[pid] || []).filter((u) => u !== me);
      });
    }
    writeLS("zivv.likes", map);
    return (remoteList || []).length;
  }

  async function pullAll() {
    if (mode === "api" || mode === "real") {
      const out = { posts: 0, likes: 0, users: 0, follows: 0, comments: 0 };
      try {
        const posts = await api("GET", "/api/posts");
        if (Array.isArray(posts)) out.posts = mergeFeed(posts.map(fromRemotePost));
      } catch {}
      try {
        const likes = await api("GET", "/api/likes");
        if (Array.isArray(likes)) out.likes = mergeLikes(likes);
      } catch {}
      try {
        const comments = await api("GET", "/api/comments");
        if (Array.isArray(comments)) {
          const map = {};
          comments.forEach((c) => {
            const id = c.post_id;
            if (!id) return;
            map[id] = map[id] || [];
            map[id].push({ id: c.id, name: c.name, by: c.user_key, text: c.body || c.text, at: c.created_at || Date.now(), parentId: c.parent_id || null });
          });
          writeLS("zivv.comments", map);
          out.comments = comments.length;
        }
      } catch {}
      try {
        const fol = await api("GET", "/api/follows");
        if (Array.isArray(fol)) {
          const g = {};
          fol.forEach((f) => {
            const a = String(f.follower || f.from_user || "").toLowerCase();
            const b = String(f.following || f.to_user || "").toLowerCase();
            if (!a || !b) return;
            g[a] = g[a] || [];
            if (g[a].indexOf(b) < 0) g[a].push(b);
          });
          writeLS("zivv.followGraph", g);
          out.follows = fol.length;
        }
      } catch {}
      try {
        const profs = await api("GET", "/api/profiles");
        if (Array.isArray(profs)) {
          const map = readLS("zivv.profiles", {});
          profs.forEach((p) => {
            const u = String(p.username || "").toLowerCase();
            if (!u) return;
            const ava = p.avatar || "";
            const prev = map[u] || {};
            map[u] = Object.assign({}, prev, { name: p.name || prev.name, user: u, avatar: isRemote(ava) ? ava : (prev.avatar || ava || "brand/logo-sm.png"), cover: isRemote(p.cover) ? p.cover : (prev.cover || p.cover || ""), city: p.city || prev.city || "", bio: p.bio || prev.bio || "", locked: p.locked != null ? !!p.locked : !!prev.locked });
          });
          writeLS("zivv.profiles", map);
        }
      } catch {}
      try {
        const acc = await api("GET", "/api/accounts");
        if (Array.isArray(acc)) {
          const users = readLS("zivv.users", {});
          acc.forEach((a) => {
            const email = a.email;
            if (!email) return;
            users[email] = Object.assign({}, users[email] || {}, { email, username: a.username, first: a.first_name || a.first, last: a.last_name || a.last, name: a.name, age: a.age, mark: a.mark, onboarding: a.onboarding || (users[email] && users[email].onboarding) || null });
          });
          writeLS("zivv.users", users);
          out.users = Object.keys(users).length;
        }
      } catch {}
      lastPull = Date.now();
      window.dispatchEvent(new CustomEvent("zivv-db", { detail: out }));
      return Object.assign({ ok: true, mode }, out);
    }
    if (!live()) return { ok: false, mode };
    // Supabase direct mode - same as before
    const out = { posts: 0, likes: 0, users: 0, follows: 0, comments: 0 };
    try {
      const posts = await sb("posts?select=*&order=created_at.desc&limit=250");
      if (Array.isArray(posts)) out.posts = mergeFeed(posts.map(fromRemotePost));
    } catch {}
    try {
      const likes = await sb("likes?select=*&limit=2000");
      if (Array.isArray(likes)) out.likes = mergeLikes(likes);
    } catch {}
    try {
      const comments = await sb("comments?select=*&order=created_at.asc&limit=2000");
      if (Array.isArray(comments)) {
        const map = {};
        comments.forEach((c) => {
          const id = c.post_id;
          if (!id) return;
          map[id] = map[id] || [];
          map[id].push({ id: c.id, name: c.name, by: c.user_key, text: c.body, at: Date.parse(c.created_at) || Date.now(), parentId: c.parent_id || null });
        });
        writeLS("zivv.comments", map);
        out.comments = comments.length;
      }
    } catch {}
    try {
      const fol = await sb("follows?select=*&limit=4000");
      if (Array.isArray(fol)) {
        const g = {};
        fol.forEach((f) => {
          const a = String(f.follower || "").toLowerCase();
          const b = String(f.following || "").toLowerCase();
          if (!a || !b) return;
          g[a] = g[a] || [];
          if (g[a].indexOf(b) < 0) g[a].push(b);
        });
        writeLS("zivv.followGraph", g);
        out.follows = fol.length;
      }
    } catch {}
    lastPull = Date.now();
    window.dispatchEvent(new CustomEvent("zivv-db", { detail: out }));
    return Object.assign({ ok: true, mode }, out);
  }

  async function pushPost(post) {
    if (!post || post.blocked) return;
    const ready = await materializePost(post);
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/posts", toRemotePost(ready));
      return;
    }
    if (!live()) return;
    await sb("posts?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: toRemotePost(ready) });
  }

  async function pushLike(postId, userKey, on) {
    if (!postId || !userKey) return;
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/likes", { post_id: postId, user_key: userKey, on: !!on });
      return;
    }
    if (!live()) return;
    if (on) await sb("likes?on_conflict=post_id,user_key", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { post_id: postId, user_key: userKey } });
    else await sb("likes?post_id=eq." + encodeURIComponent(postId) + "&user_key=eq." + encodeURIComponent(userKey), { method: "DELETE", prefer: "return=minimal" });
  }

  async function pushComment(c) {
    if (!c) return;
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/comments", { id: c.id, post_id: c.postId, parent_id: c.parentId || null, name: c.name, user_key: c.by, body: c.text });
      return;
    }
    if (!live()) return;
    await sb("comments?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: c.id, post_id: c.postId, parent_id: c.parentId || null, name: c.name, user_key: c.by, body: c.text } });
  }

  async function pushFollow(from, to, on) {
    if (!from || !to) return;
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/follows", { from_user: from, to_user: to, on: !!on });
      return;
    }
    if (!live()) return;
    const a = String(from).toLowerCase(), b = String(to).toLowerCase();
    if (on) await sb("follows?on_conflict=follower,following", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { follower: a, following: b } });
    else await sb("follows?follower=eq." + encodeURIComponent(a) + "&following=eq." + encodeURIComponent(b), { method: "DELETE", prefer: "return=minimal" });
  }

  async function pushMessage(toUser, m) {
    if (!m) return;
    if (mode === "api" || mode === "real") {
      const me = (window.ZIVV_CORE && ZIVV_CORE.author && ZIVV_CORE.author().user) || "";
      const ua = String(me || "").toLowerCase();
      const ub = String(toUser || "").toLowerCase();
      const pair = ua < ub ? ua + "::" + ub : ub + "::" + ua;
      await api("POST", "/api/messages", { id: m.id, thread_user: pair, from_key: m.from, from_user: m.fromUser || me, name: m.name, kind: m.kind || "text", body: m.text || "", post_id: m.postId || null, image_url: slimMedia(m.image) });
      return;
    }
    if (!live()) return;
    const me = (window.ZIVV_CORE && ZIVV_CORE.author && ZIVV_CORE.author().user) || "";
    const ua = String(me || "").toLowerCase();
    const ub = String(toUser || "").toLowerCase();
    const pair = ua < ub ? ua + "::" + ub : ub + "::" + ua;
    await sb("messages?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: m.id, thread_user: pair, from_key: m.from, from_user: m.fromUser || me, name: m.name, kind: m.kind || "text", body: m.text || "", post_id: m.postId || null, product_id: m.productId || null, image_url: slimMedia(m.image) } });
  }

  async function upsertAccount(u) {
    if (!u || !u.email) return;
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/accounts", { email: String(u.email).toLowerCase(), username: u.username, first_name: u.first || "", last_name: u.last || "", name: u.name || "", age: u.age || null, mark: u.mark || "", password: u.password || "", onboarding: u.onboarding || null });
      await upsertProfile(u);
      return;
    }
    if (!live()) return;
    const email = String(u.email).toLowerCase();
    await sb("accounts?on_conflict=email", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { email, username: u.username || email.split("@")[0], first_name: u.first || "", last_name: u.last || "", name: u.name || "", age: u.age || null, mark: u.mark || "", password: u.password || "", onboarding: u.onboarding || null } });
    await upsertProfile(u);
  }

  async function upsertProfile(u) {
    if (!u) return;
    const username = String(u.username || (u.email || "").split("@")[0] || "").toLowerCase();
    let avatar = u.avatar || "";
    if (avatar && !isRemote(avatar)) {
      const up = await uploadMedia(avatar, username + "-ava");
      if (up) avatar = up;
    }
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/profiles", { email: u.email, username: u.username || username, name: u.name, avatar, bio: u.bio || "", city: u.city || "", age: u.age, locked: !!u.locked, onboarding: u.onboarding || null });
      return;
    }
    if (!live()) return;
    if (!username) return;
    const body = { email: u.email ? String(u.email).toLowerCase() : username + "@zivv.local", username, name: u.name || username, avatar, bio: u.bio || "", city: u.city || "", age: u.age || null, locked: !!u.locked, onboarding: u.onboarding || null };
    try { await sb("profiles?on_conflict=username", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body }); }
    catch { await sb("profiles?on_conflict=email", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body }); }
  }

  async function loginRemote(email, password) {
    if (!remote()) return null;
    try {
      const res = await api("POST", "/api/auth/login", { email, password });
      if (res && res.user) return res.user;
    } catch {}
    // Fallback old method
    try {
      const rows = mode === "api" || mode === "real" ? await api("GET", "/api/accounts") : await sb("accounts?select=*&limit=400");
      const hit = (rows || []).find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
      if (hit) return { email: hit.email, username: hit.username, first: hit.first_name, last: hit.last_name, name: hit.name, age: hit.age, mark: hit.mark, onboarding: hit.onboarding };
    } catch {}
    return null;
  }

  async function registerRemote(data) {
    try {
      const res = await api("POST", "/api/auth/register", data);
      if (res && res.user) return res.user;
    } catch (e) {
      throw e;
    }
    return null;
  }

  async function pushStory(s) {
    if (!s) return;
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/stories", { id: s.id, username: s.user, name: s.name, avatar: slimMedia(s.avatar), kind: s.kind, body: s.text || "", image_url: slimMedia(s.image), video_url: s.videoId || "" });
      return;
    }
    if (!live()) return;
    await sb("stories?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: s.id, username: s.user, name: s.name, avatar: slimMedia(s.avatar), kind: s.kind, body: s.text || "", image_url: slimMedia(s.image), video_url: s.videoId || "" } });
  }

  async function pushFriend(r) {
    if (!live() && mode !== "api" && mode !== "real") return;
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/friends", { id: r.id, from_user: r.from, from_name: r.fromName, to_user: r.to, to_name: r.toName, status: r.status }).catch(() => {});
      return;
    }
    await sb("friend_reqs?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: r.id, from_user: r.from, from_name: r.fromName, to_user: r.to, to_name: r.toName, status: r.status } }).catch(() => {});
  }

  async function pushNote(n) {
    if (!n) return;
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/notes", { id: n.id, dest: n.to, type: n.type, title: n.title || "", body: n.text || "", from_user: n.from, from_name: n.fromName, avatar: slimMedia(n.avatar), href: n.href, post_id: n.postId || null, unread: n.unread !== false }).catch(() => {});
      return;
    }
    if (!live()) return;
    await sb("notes?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: n.id, dest: n.to, type: n.type, title: n.title || "", body: n.text || "", from_user: n.from, from_name: n.fromName, avatar: slimMedia(n.avatar), href: n.href, post_id: n.postId || null, unread: n.unread !== false } }).catch(() => {});
  }

  async function pushGold(r) {
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/gold", { id: r.id, username: r.user, name: r.name, status: r.status, note: r.note || "" }).catch(() => {});
      return;
    }
    if (!live()) return;
    await sb("gold_reqs?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: r.id, username: r.user, name: r.name, status: r.status, note: r.note || "" } }).catch(() => {});
  }

  async function pushReport(r) {
    if (mode === "api" || mode === "real") {
      await api("POST", "/api/reports", { id: r.id, post_id: r.postId || null, target_user: r.targetUser || r.postUser, type: r.type || "post", dest: r.dest || "king", reporter_name: r.reporterName, reporter_email: r.reporterEmail, note: r.note }).catch(() => {});
      return;
    }
    if (!live()) return;
    await sb("reports?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: r.id, post_id: r.postId || null, target_user: r.targetUser || r.postUser, type: r.type || "post", dest: r.dest || "king", reporter_name: r.reporterName, reporter_email: r.reporterEmail, note: r.note } }).catch(() => {});
  }

  async function pushAiChat(chat) {
    if (!chat) return;
    if (mode === "api" || mode === "real") {
      const me = (window.ZIVV_CORE && ZIVV_CORE.author && ZIVV_CORE.author().user) || "anon";
      await api("POST", "/api/ai-chats", { id: chat.id, user_key: me, title: chat.title || "دردشة جديدة", model: chat.model || "gemini-3.6-flash" }).catch(() => {});
    }
  }

  async function pushAiMessage(chatId, msg) {
    if (!chatId || !msg) return;
    if (mode === "api" || mode === "real") {
      const me = (window.ZIVV_CORE && ZIVV_CORE.author && ZIVV_CORE.author().user) || "anon";
      await api("POST", "/api/ai-messages", { id: msg.id || "aim_" + Date.now(), chat_id: chatId, role: msg.role, content: msg.content, image_url: msg.image || "", sources: msg.sources || [], user_key: me, chat_title: msg.chatTitle || "" }).catch(() => {});
    }
  }

  function wrap() {
    if (window.ZIVV_CORE && !ZIVV_CORE._dbWrapped) {
      ZIVV_CORE._dbWrapped = true;
      const addPost = ZIVV_CORE.addPost;
      ZIVV_CORE.addPost = function (p) {
        const r = addPost(p);
        if (r && !r.blocked) { r._pending = true; pushPost(r).catch(() => {}); }
        return r;
      };
      const toggleLike = ZIVV_CORE.toggleLike;
      ZIVV_CORE.toggleLike = function (id) {
        const on = toggleLike(id);
        pushLike(id, ZIVV_CORE.meKey(), on).catch(() => {});
        return on;
      };
      const addComment = ZIVV_CORE.addComment;
      ZIVV_CORE.addComment = function (postId, text, parentId) {
        const list = addComment(postId, text, parentId);
        const last = list && list[list.length - 1];
        if (last) pushComment(Object.assign({ postId }, last)).catch(() => {});
        return list;
      };
      if (ZIVV_CORE.sendMessage) {
        const sendMessage = ZIVV_CORE.sendMessage;
        ZIVV_CORE.sendMessage = function (to, payload, priv) {
          const m = sendMessage(to, payload, priv);
          if (m && !priv) pushMessage(to, m).catch(() => {});
          return m;
        };
      }
      if (ZIVV_CORE.followUser) {
        const fol = ZIVV_CORE.followUser;
        const unf = ZIVV_CORE.unfollowUser;
        ZIVV_CORE.followUser = function (u) {
          const r = fol(u);
          if (r) pushFollow(ZIVV_CORE.author().user, u, true).catch(() => {});
          return r;
        };
        ZIVV_CORE.unfollowUser = function (u) {
          const r = unf(u);
          pushFollow(ZIVV_CORE.author().user, u, false).catch(() => {});
          return r;
        };
      }
    }
  }

  async function detect() {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok) {
          mode = j.engine === "real-database" ? "real" : "api";
          realDbInfo = j;
          done();
          pullAll().catch(() => {});
          return;
        }
      }
    } catch {}
    const c = cfg();
    if (c.url && c.anon) {
      try {
        await ping();
        mode = "supabase";
        done();
        await pullAll();
        return;
      } catch (e) {
        const msg = String((e && e.message) || e || "");
        if (/PGRST205|Could not find the table/i.test(msg)) { mode = "need-sql"; done(); return; }
        mode = "local"; done(); return;
      }
    }
    mode = "local"; done();
  }

  window.ZIVV_DB = {
    get mode() { return mode; },
    get info() { return realDbInfo; },
    enabled: true,
    whenReady,
    syncAll: pullAll,
    ping,
    pushPost,
    pushLike,
    pushComment,
    pushMessage,
    pushStory,
    pushFriend,
    pushNote,
    pushGold,
    upsertProfile,
    upsertAccount,
    loginRemote,
    registerRemote,
    pushAiChat,
    pushAiMessage,
    pullPosts: pullAll,
    lastPull() { return lastPull; },
    needsSql() { return mode === "need-sql"; },
    uploadMedia,
    isReal() { return mode === "real" || mode === "api" || mode === "supabase"; }
  };

  setInterval(wrap, 250);
  wrap();
  detect();
  setInterval(() => { if (remote()) pullAll().catch(() => {}); }, 10000);
})();
