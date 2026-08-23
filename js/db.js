(function () {
  let mode = "local";
  let apiBase = "";
  let sb = null;
  let ready = false;
  const waiters = [];

  function done() {
    ready = true;
    waiters.splice(0).forEach((fn) => fn(mode));
  }
  function whenReady(fn) {
    if (ready) fn(mode);
    else waiters.push(fn);
  }

  async function detect() {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok) {
          mode = "api";
          apiBase = "";
          done();
          pullAll();
          return;
        }
      }
    } catch {}
    const cfg = window.ZIVV_SUPABASE_CFG || {};
    if (cfg.url && cfg.anon) {
      mode = "supabase";
      done();
      return;
    }
    mode = "local";
    done();
  }

  async function api(method, path, body) {
    const opt = { method, headers: { "Content-Type": "application/json" } };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(apiBase + path, opt);
    return r.json();
  }

  function fromApiPost(r) {
    return {
      id: r.id,
      name: r.name,
      user: r.username || r.user,
      avatar: r.avatar,
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
      time: "الآن",
      likes: 0,
      comments: [],
      following: true,
      ai: false,
    };
  }

  async function pullAll() {
    if (mode !== "api") return;
    try {
      const posts = await api("GET", "/api/posts");
      if (Array.isArray(posts) && posts.length) {
        localStorage.setItem("zivv.feed", JSON.stringify(posts.map(fromApiPost)));
      }
    } catch {}
    try {
      const products = await api("GET", "/api/products");
      if (Array.isArray(products)) {
        const mine = products.map((p) => ({
          id: p.id,
          title: p.title,
          price: Number(p.price) || 0,
          cat: p.cat || "عام",
          seller: p.seller,
          sellerUser: p.seller_user || p.sellerUser,
          phone: p.phone,
          image: p.image_url || p.image,
          desc: p.description || p.desc,
          specs: p.specs || [],
        }));
        localStorage.setItem("zivv.myProducts", JSON.stringify(mine));
      }
    } catch {}
  }

  async function pushPost(post) {
    if (!post || post.blocked) return;
    if (mode === "api") {
      await api("POST", "/api/posts", {
        id: post.id,
        username: post.user,
        name: post.name,
        avatar: post.avatar,
        title: post.title,
        body: post.text,
        type: post.type,
        video_kind: post.videoKind,
        tags: post.tags,
        dests: post.dests,
        image_url: post.image && String(post.image).startsWith("data:") ? "" : post.image,
        video_url: post.videoId,
        audio_url: post.audioId,
        sound_url: post.soundId,
        mute_original: !!post.muteOriginal,
        link: post.link,
        place: post.place,
        status: post.status,
      });
    }
  }

  async function pushLike(postId, userKey, on) {
    if (mode === "api") await api("POST", "/api/likes", { post_id: postId, user_key: userKey, on: !!on });
  }

  async function pushComment(c) {
    if (mode === "api") {
      await api("POST", "/api/comments", {
        id: c.id,
        post_id: c.postId,
        parent_id: c.parentId || null,
        name: c.name,
        user_key: c.by,
        body: c.text,
      });
    }
  }

  async function pushProduct(p) {
    if (mode === "api") {
      await api("POST", "/api/products", {
        id: p.id,
        title: p.title,
        price: p.price,
        cat: p.cat,
        seller: p.seller,
        seller_user: p.sellerUser,
        phone: p.phone,
        image_url: p.image && String(p.image).startsWith("data:") ? "" : p.image,
        description: p.desc,
        specs: p.specs || [],
      });
    }
  }

  async function pushMessage(toUser, m) {
    if (mode === "api") {
      await api("POST", "/api/messages", {
        id: m.id,
        thread_user: toUser,
        from_key: m.from,
        from_user: m.fromUser,
        name: m.name,
        kind: m.kind || "text",
        body: m.text || "",
        post_id: m.postId || null,
        product_id: m.productId || null,
        image_url: m.image || "",
      });
    }
  }

  async function upsertProfile(u) {
    if (mode === "api" && u && u.email) {
      await api("POST", "/api/profiles", {
        email: String(u.email).toLowerCase(),
        username: u.username || String(u.email).split("@")[0],
        name: u.name,
        age: u.age || null,
        onboarding: u.onboarding || null,
      });
    }
  }

  function wrap() {
    if (window.ZIVV_CORE && !ZIVV_CORE._dbWrapped) {
      ZIVV_CORE._dbWrapped = true;
      const addPost = ZIVV_CORE.addPost;
      ZIVV_CORE.addPost = function (p) {
        const r = addPost(p);
        if (r && !r.blocked) pushPost(r).catch(() => {});
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
        ZIVV_CORE.sendMessage = function (to, payload) {
          const m = sendMessage(to, payload);
          if (m) pushMessage(to, m).catch(() => {});
          return m;
        };
      }
    }
    if (window.ZIVV_STORE && !ZIVV_STORE._dbWrapped) {
      ZIVV_STORE._dbWrapped = true;
      const add = ZIVV_STORE.addUserProduct;
      ZIVV_STORE.addUserProduct = function (p) {
        const r = add(p);
        pushProduct(p).catch(() => {});
        return r;
      };
    }
  }

  window.ZIVV_DB = {
    get mode() {
      return mode;
    },
    enabled: true,
    whenReady,
    syncAll: pullAll,
    pushPost,
    pushLike,
    pushComment,
    pushProduct,
    pushMessage,
    upsertProfile,
    pullPosts: pullAll,
    pullProducts: pullAll,
  };

  setInterval(wrap, 250);
  wrap();
  detect();
})();
