(function () {
  let mode = "local";
  let ready = false;
  const waiters = [];
  let lastPull = 0;

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
    } catch {
      return fallback;
    }
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
  function live() {
    return mode === "supabase" && cfg().url && cfg().anon;
  }

  async function sb(path, opt) {
    const { url, anon } = cfg();
    if (!url || !anon) throw new Error("no supabase");
    opt = opt || {};
    const headers = Object.assign(
      {
        apikey: anon,
        "Content-Type": "application/json",
        Prefer: opt.prefer || "return=representation"
      },
      opt.headers || {}
    );
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

  function slimMedia(s) {
    const v = String(s || "");
    if (v.startsWith("data:") && v.length > 4000) return "";
    return v;
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
      priv: !!p.priv
    };
  }
  function fromRemotePost(r) {
    return {
      id: r.id,
      name: r.name,
      user: r.username || r.user,
      avatar: r.avatar || "brand/logo-sm.png",
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
      likes: 0,
      comments: [],
      following: true,
      ai: false
    };
  }

  async function pullAll() {
    if (!live()) return { ok: false, mode };
    const out = { posts: 0, likes: 0, users: 0, follows: 0, comments: 0 };
    try {
      const posts = await sb("posts?select=*&order=created_at.desc&limit=250");
      if (Array.isArray(posts)) {
        const mapped = posts.map(fromRemotePost);
        const local = readLS("zivv.feed", []);
        const remoteIds = new Set(mapped.map((p) => p.id));
        local.forEach((p) => {
          if (p && p.id && !remoteIds.has(p.id) && p._pending) mapped.unshift(p);
        });
        writeLS("zivv.feed", mapped);
        out.posts = mapped.length;
      }
    } catch {}
    try {
      const likes = await sb("likes?select=*&limit=2000");
      if (Array.isArray(likes)) {
        const map = {};
        likes.forEach((x) => {
          if (!x.post_id || !x.user_key) return;
          map[x.post_id] = map[x.post_id] || [];
          if (map[x.post_id].indexOf(x.user_key) < 0) map[x.post_id].push(x.user_key);
        });
        writeLS("zivv.likes", map);
        out.likes = likes.length;
      }
    } catch {}
    try {
      const comments = await sb("comments?select=*&order=created_at.asc&limit=2000");
      if (Array.isArray(comments)) {
        const map = {};
        comments.forEach((c) => {
          const id = c.post_id;
          if (!id) return;
          map[id] = map[id] || [];
          map[id].push({
            id: c.id,
            name: c.name,
            by: c.user_key,
            text: c.body,
            at: Date.parse(c.created_at) || Date.now(),
            parentId: c.parent_id || null
          });
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
    try {
      const acc = await sb("accounts?select=*&limit=500");
      if (Array.isArray(acc)) {
        const users = readLS("zivv.users", {});
        acc.forEach((a) => {
          if (!a.email) return;
          users[a.email] = Object.assign({}, users[a.email] || {}, {
            email: a.email,
            username: a.username,
            first: a.first_name,
            last: a.last_name,
            name: a.name,
            age: a.age,
            mark: a.mark,
            password: a.password,
            onboarding: a.onboarding || (users[a.email] && users[a.email].onboarding) || null
          });
        });
        writeLS("zivv.users", users);
        out.users = Object.keys(users).length;
      }
    } catch {}
    try {
      const profs = await sb("profiles?select=*&limit=500");
      if (Array.isArray(profs)) {
        const map = readLS("zivv.profiles", {});
        profs.forEach((p) => {
          const u = String(p.username || "").toLowerCase();
          if (!u) return;
          map[u] = Object.assign({}, map[u] || {}, {
            name: p.name,
            user: u,
            avatar: p.avatar || "brand/logo-sm.png",
            city: p.city || "",
            locked: !!p.locked
          });
        });
        writeLS("zivv.profiles", map);
      }
    } catch {}
    try {
      const msgs = await sb("messages?select=*&order=created_at.asc&limit=2000");
      if (Array.isArray(msgs)) {
        const chats = {};
        msgs.forEach((m) => {
          const k = m.thread_user || "";
          if (!k) return;
          chats[k] = chats[k] || [];
          chats[k].push({
            id: m.id,
            from: m.from_key,
            fromUser: m.from_user,
            name: m.name,
            kind: m.kind || "text",
            text: m.body || "",
            postId: m.post_id || "",
            image: m.image_url || "",
            at: Date.parse(m.created_at) || Date.now()
          });
        });
        writeLS("zivv.chats", chats);
      }
    } catch {}
    try {
      const st = await sb("stories?select=*&order=created_at.desc&limit=80");
      if (Array.isArray(st)) {
        writeLS(
          "zivv.stories",
          st.map((s) => ({
            id: s.id,
            name: s.name,
            user: s.username,
            avatar: s.avatar,
            kind: s.kind,
            text: s.body || "",
            image: s.image_url || "",
            videoId: s.video_url || "",
            at: Date.parse(s.created_at) || Date.now()
          }))
        );
      }
    } catch {}
    try {
      const fr = await sb("friend_reqs?select=*&order=created_at.desc&limit=400");
      if (Array.isArray(fr)) {
        writeLS(
          "zivv.friendReqs",
          fr.map((r) => ({
            id: r.id,
            from: r.from_user,
            fromName: r.from_name,
            to: r.to_user,
            toName: r.to_name,
            status: r.status,
            at: Date.parse(r.created_at) || Date.now()
          }))
        );
      }
    } catch {}
    try {
      const notes = await sb("notes?select=*&order=created_at.desc&limit=200");
      if (Array.isArray(notes)) {
        writeLS(
          "zivv.notes",
          notes.map((n) => ({
            id: n.id,
            to: n.dest,
            type: n.type,
            title: n.title || "",
            text: n.body || "",
            from: n.from_user,
            fromName: n.from_name,
            avatar: n.avatar,
            href: n.href,
            postId: n.post_id,
            unread: n.unread !== false,
            at: Date.parse(n.created_at) || Date.now()
          }))
        );
      }
    } catch {}
    try {
      const gold = await sb("gold_reqs?select=*&limit=200");
      if (Array.isArray(gold)) {
        writeLS(
          "zivv.goldReqs",
          gold.map((g) => ({
            id: g.id,
            user: g.username,
            name: g.name,
            status: g.status,
            note: g.note,
            at: Date.parse(g.created_at) || Date.now()
          }))
        );
      }
    } catch {}
    lastPull = Date.now();
    window.dispatchEvent(new CustomEvent("zivv-db", { detail: out }));
    return Object.assign({ ok: true, mode }, out);
  }

  async function pushPost(post) {
    if (!live() || !post || post.blocked) return;
    await sb("posts?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: toRemotePost(post) });
  }
  async function pushLike(postId, userKey, on) {
    if (!live() || !postId || !userKey) return;
    if (on) {
      await sb("likes?on_conflict=post_id,user_key", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { post_id: postId, user_key: userKey }
      });
    } else {
      await sb(
        "likes?post_id=eq." + encodeURIComponent(postId) + "&user_key=eq." + encodeURIComponent(userKey),
        { method: "DELETE", prefer: "return=minimal" }
      );
    }
  }
  async function pushComment(c) {
    if (!live() || !c) return;
    await sb("comments?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: c.id,
        post_id: c.postId,
        parent_id: c.parentId || null,
        name: c.name,
        user_key: c.by,
        body: c.text
      }
    });
  }
  async function pushFollow(from, to, on) {
    if (!live() || !from || !to) return;
    const a = String(from).toLowerCase();
    const b = String(to).toLowerCase();
    if (on) {
      await sb("follows?on_conflict=follower,following", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { follower: a, following: b }
      });
    } else {
      await sb(
        "follows?follower=eq." + encodeURIComponent(a) + "&following=eq." + encodeURIComponent(b),
        { method: "DELETE", prefer: "return=minimal" }
      );
    }
  }
  async function pushMessage(toUser, m) {
    if (!live() || !m) return;
    const me = (window.ZIVV_CORE && ZIVV_CORE.author && ZIVV_CORE.author().user) || "";
    const ua = String(me || "").toLowerCase();
    const ub = String(toUser || "").toLowerCase();
    const pair = ua < ub ? ua + "::" + ub : ub + "::" + ua;
    await sb("messages?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: m.id,
        thread_user: pair,
        from_key: m.from,
        from_user: m.fromUser || me,
        name: m.name,
        kind: m.kind || "text",
        body: m.text || "",
        post_id: m.postId || null,
        product_id: m.productId || null,
        image_url: slimMedia(m.image)
      }
    });
  }
  async function pushProduct(p) {
    if (!live() || !p) return;
    await sb("products?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: p.id,
        title: p.title,
        price: p.price,
        cat: p.cat,
        seller: p.seller,
        seller_user: p.sellerUser,
        phone: p.phone,
        image_url: slimMedia(p.image),
        description: p.desc,
        specs: p.specs || []
      }
    });
  }
  async function upsertAccount(u) {
    if (!u || !u.email) return;
    if (!live()) return;
    const email = String(u.email).toLowerCase();
    await sb("accounts?on_conflict=email", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        email,
        username: u.username || email.split("@")[0],
        first_name: u.first || "",
        last_name: u.last || "",
        name: u.name || "",
        age: u.age || null,
        mark: u.mark || "",
        password: u.password || "",
        onboarding: u.onboarding || null
      }
    });
    await upsertProfile(u);
  }
  async function upsertProfile(u) {
    if (!u) return;
    if (!live()) return;
    const username = String(u.username || (u.email || "").split("@")[0] || "").toLowerCase();
    if (!username) return;
    const body = {
      email: u.email ? String(u.email).toLowerCase() : username + "@zivv.local",
      username,
      name: u.name || username,
      avatar: slimMedia(u.avatar),
      age: u.age || null,
      locked: !!u.locked,
      onboarding: u.onboarding || null
    };
    try {
      await sb("profiles?on_conflict=username", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body
      });
    } catch {
      await sb("profiles?on_conflict=email", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body
      });
    }
  }
  async function loginRemote(first, last, mark, pass, age) {
    if (!live()) return null;
    const fold = (s) =>
      String(s || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه");
    const rows = await sb("accounts?select=*&limit=400");
    const hit = (rows || []).find(
      (u) =>
        fold(u.first_name) === fold(first) &&
        fold(u.last_name) === fold(last) &&
        fold(u.mark) === fold(mark) &&
        String(u.password) === String(pass) &&
        String(u.age) === String(age)
    );
    if (!hit) return null;
    const user = {
      email: hit.email,
      username: hit.username,
      first: hit.first_name,
      last: hit.last_name,
      name: hit.name,
      age: hit.age,
      mark: hit.mark,
      password: hit.password,
      onboarding: hit.onboarding
    };
    const db = readLS("zivv.users", {});
    db[hit.email] = user;
    writeLS("zivv.users", db);
    return user;
  }
  async function pushStory(s) {
    if (!live() || !s) return;
    await sb("stories?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: s.id,
        username: s.user,
        name: s.name,
        avatar: slimMedia(s.avatar),
        kind: s.kind,
        body: s.text || "",
        image_url: slimMedia(s.image),
        video_url: s.videoId || ""
      }
    });
  }
  async function pushFriend(r) {
    if (!live() || !r) return;
    await sb("friend_reqs?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: r.id,
        from_user: r.from,
        from_name: r.fromName,
        to_user: r.to,
        to_name: r.toName,
        status: r.status
      }
    });
  }
  async function pushNote(n) {
    if (!live() || !n) return;
    await sb("notes?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: n.id,
        dest: n.to,
        type: n.type,
        title: n.title || "",
        body: n.text || "",
        from_user: n.from,
        from_name: n.fromName,
        avatar: slimMedia(n.avatar),
        href: n.href,
        post_id: n.postId || null,
        unread: n.unread !== false
      }
    });
  }
  async function pushGold(r) {
    if (!live() || !r) return;
    await sb("gold_reqs?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { id: r.id, username: r.user, name: r.name, status: r.status, note: r.note || "" }
    });
  }
  async function pushReport(r) {
    if (!live() || !r) return;
    await sb("reports?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        id: r.id,
        post_id: r.postId || null,
        target_user: r.targetUser || r.postUser,
        type: r.type || "post",
        dest: r.dest || "king",
        reporter_name: r.reporterName,
        reporter_email: r.reporterEmail,
        note: r.note
      }
    });
  }

  async function seedLocal() {
    return;
  }

  function wrap() {
    if (window.ZIVV_CORE && !ZIVV_CORE._dbWrapped) {
      ZIVV_CORE._dbWrapped = true;
      const addPost = ZIVV_CORE.addPost;
      ZIVV_CORE.addPost = function (p) {
        const r = addPost(p);
        if (r && !r.blocked) {
          r._pending = true;
          pushPost(r).catch(() => {});
        }
        return r;
      };
      if (ZIVV_CORE.updatePost) {
        const up = ZIVV_CORE.updatePost;
        ZIVV_CORE.updatePost = function (id, patch) {
          const r = up(id, patch);
          if (r && !r.blocked) pushPost(r).catch(() => {});
          return r;
        };
      }
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
      if (ZIVV_CORE.sendFriendRequest) {
        const sfr = ZIVV_CORE.sendFriendRequest;
        ZIVV_CORE.sendFriendRequest = function (to, name) {
          const st = sfr(to, name);
          const list = (ZIVV_CORE.incomingFriendRequests && []) || [];
          const all = JSON.parse(localStorage.getItem("zivv.friendReqs") || "[]");
          const last = all[0];
          if (last) pushFriend(last).catch(() => {});
          return st;
        };
      }
      if (ZIVV_CORE.setFriendRequest) {
        const setFr = ZIVV_CORE.setFriendRequest;
        ZIVV_CORE.setFriendRequest = function (id, status) {
          const r = setFr(id, status);
          if (r) pushFriend(r).catch(() => {});
          return r;
        };
      }
      if (ZIVV_CORE.reportPost) {
        const rp = ZIVV_CORE.reportPost;
        ZIVV_CORE.reportPost = function (post, note) {
          const r = rp(post, note);
          if (r) pushReport(r).catch(() => {});
          return r;
        };
      }
      if (ZIVV_CORE.requestGold) {
        const rg = ZIVV_CORE.requestGold;
        ZIVV_CORE.requestGold = function () {
          const st = rg();
          const list = JSON.parse(localStorage.getItem("zivv.goldReqs") || "[]");
          if (list[0]) pushGold(list[0]).catch(() => {});
          return st;
        };
      }
      if (ZIVV_CORE.pushNote) {
        const pn = ZIVV_CORE.pushNote;
        ZIVV_CORE.pushNote = function (to, payload) {
          const n = pn(to, payload);
          if (n) pushNote(n).catch(() => {});
          return n;
        };
      }
    }
    if (window.ZIVV_STORE && !ZIVV_STORE._dbWrapped && ZIVV_STORE.addUserProduct) {
      ZIVV_STORE._dbWrapped = true;
      const add = ZIVV_STORE.addUserProduct;
      ZIVV_STORE.addUserProduct = function (p) {
        const r = add(p);
        pushProduct(p).catch(() => {});
        return r;
      };
    }
  }

  async function detect() {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok) {
          mode = "api";
          done();
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
        if (/PGRST205|Could not find the table/i.test(msg)) {
          mode = "need-sql";
          done();
          return;
        }
        mode = "local";
        done();
        return;
      }
    }
    mode = "local";
    done();
  }

  window.ZIVV_DB = {
    get mode() { return mode; },
    enabled: true,
    whenReady,
    syncAll: pullAll,
    ping,
    pushPost,
    pushLike,
    pushComment,
    pushProduct,
    pushMessage,
    pushStory,
    pushFriend,
    pushNote,
    pushGold,
    upsertProfile,
    upsertAccount,
    loginRemote,
    pullPosts: pullAll,
    pullProducts: pullAll,
    lastPull() { return lastPull; },
    needsSql() { return mode === "need-sql"; }
  };

  setInterval(wrap, 250);
  wrap();
  detect();
  setInterval(() => {
    if (live()) pullAll().catch(() => {});
  }, 8000);
})();
