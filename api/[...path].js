const { getDatabase } = require("../lib/database");
const { hashPassword, verifyPassword, generateId, normalizeEmail } = require("../lib/auth");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

function parts(req) {
  const q = req.query.path;
  if (Array.isArray(q)) return q;
  if (typeof q === "string") return q.split("/").filter(Boolean);
  const url = req.url || "";
  return url.replace(/^\/api\/?/, "").split("?")[0].split("/").filter(Boolean);
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try { return Promise.resolve(JSON.parse(req.body || "{}")); } catch { return Promise.resolve({}); }
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function toRemotePost(p) {
  return {
    id: p.id,
    username: p.user || p.username || "",
    name: p.name || "",
    avatar: p.avatar || "",
    title: p.title || "",
    body: p.text || p.body || "",
    type: p.type || "text",
    video_kind: p.videoKind || p.video_kind || "",
    tags: p.tags || [],
    dests: p.dests || [],
    image_url: p.image || p.image_url || "",
    video_url: p.videoId || p.video_url || "",
    audio_url: p.audioId || p.audio_url || "",
    sound_url: p.soundId || p.sound_url || "",
    mute_original: !!p.muteOriginal,
    link: p.link || "",
    place: p.place || "",
    status: p.status || "ok",
    visibility: p.visibility || "",
    priv: !!p.priv,
    extra: p.extra || {},
    created_at: p.created_at || Date.now(),
  };
}

function fromRemotePost(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    user: r.username || r.user,
    username: r.username,
    avatar: r.avatar || r.image_url || "brand/logo-sm.png",
    title: r.title || "",
    text: r.body || r.text || "",
    body: r.body || "",
    type: r.type || "text",
    videoKind: r.video_kind || r.videoKind || "",
    video_kind: r.video_kind || "",
    tags: r.tags || (typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : []),
    dests: r.dests || (typeof r.dests === "string" ? JSON.parse(r.dests || "[]") : []),
    image: r.image_url || r.image || "",
    image_url: r.image_url || "",
    videoId: r.video_url || r.videoId || "",
    video_url: r.video_url || "",
    audioId: r.audio_url || r.audioId || "",
    audio_url: r.audio_url || "",
    soundId: r.sound_url || r.soundId || "",
    sound_url: r.sound_url || "",
    muteOriginal: !!(r.mute_original || r.muteOriginal),
    link: r.link || "",
    place: r.place || "",
    status: r.status || "ok",
    visibility: r.visibility || "",
    priv: !!r.priv,
    likes_count: r.likes_count || 0,
    comments_count: r.comments_count || 0,
    time: "الآن",
    likes: r.likes_count || 0,
    comments: [],
    following: true,
    ai: false,
    created_at: r.created_at,
  };
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const segs = parts(req);
  const p = "/" + segs.join("/");
  const db = getDatabase();

  try {
    // Health
    if (p === "/health" || p === "/") {
      const posts = await db.getPosts(1).catch(() => []);
      const accounts = await db.getAccounts().catch(() => []);
      return res.status(200).json({
        ok: true,
        engine: "real-database",
        mode: db.mode,
        real: true,
        posts: posts.length,
        accounts: accounts.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Reset (dangerous, needs confirm)
    if (p === "/reset" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.confirm || "") !== "ZIVV-WIPE") return res.status(403).json({ error: "confirm required" });
      return res.status(200).json({ ok: true, message: "Use SQL to truncate tables in real DB mode" });
    }

    // ==================== GET ====================
    if (req.method === "GET") {
      if (p === "/posts") {
        const limit = Number(req.query.limit || 250);
        const rows = await db.getPosts(limit);
        return res.status(200).json(rows.map(fromRemotePost).filter(Boolean));
      }
      if (p === "/likes") {
        const postId = (req.query && req.query.post_id) || "";
        const list = await db.getLikes(postId || null);
        return res.status(200).json(list.map(l => ({ post_id: l.post_id, user_key: l.user_key || l.userKey, created_at: l.created_at })));
      }
      if (p === "/comments") {
        const postId = (req.query && req.query.post_id) || "";
        const list = await db.getComments(postId || null);
        return res.status(200).json(list.map(c => ({
          id: c.id,
          post_id: c.post_id,
          parent_id: c.parent_id,
          name: c.name,
          user_key: c.user_key,
          body: c.body,
          created_at: c.created_at,
        })));
      }
      if (p === "/products") {
        const rows = await db.getProducts();
        return res.status(200).json(rows);
      }
      if (p === "/messages") {
        const user = (req.query && req.query.user) || "";
        const list = await db.getMessages(user || null);
        return res.status(200).json(list);
      }
      if (p === "/follows") {
        const rows = await db.getFollows();
        return res.status(200).json(rows);
      }
      if (p === "/profiles") {
        const rows = await db.getProfiles();
        return res.status(200).json(rows);
      }
      if (p === "/accounts") {
        const rows = await db.getAccounts();
        // Don't expose password hashes
        const safe = rows.map(r => {
          const { password, password_hash, ...rest } = r;
          return rest;
        });
        return res.status(200).json(safe);
      }
      if (p === "/stories") {
        const rows = await db.getStories();
        return res.status(200).json(rows);
      }
      if (p === "/friends") {
        const rows = await db.getFriendReqs();
        return res.status(200).json(rows);
      }
      if (p === "/notes") {
        const dest = (req.query && req.query.dest) || "";
        const rows = await db.getNotes(dest || null);
        return res.status(200).json(rows);
      }
      if (p === "/gold") {
        const rows = await db.getGoldReqs();
        return res.status(200).json(rows);
      }
      if (p === "/reports") {
        const rows = await db.getReports();
        return res.status(200).json(rows);
      }
      if (p === "/ai-chats") {
        const user = (req.query && req.query.user) || "";
        if (!user) return res.status(400).json({ error: "user required" });
        const rows = await db.getAiChats(user);
        return res.status(200).json(rows);
      }
      if (p === "/ai-messages") {
        const chatId = (req.query && req.query.chat_id) || "";
        if (!chatId) return res.status(400).json({ error: "chat_id required" });
        const rows = await db.getAiMessages(chatId);
        return res.status(200).json(rows);
      }

      return res.status(404).json({ error: "not found", path: p });
    }

    // ==================== POST ====================
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

    const body = await readBody(req);

    if (p === "/posts") {
      const row = toRemotePost({ id: "p" + Date.now(), created_at: new Date().toISOString(), status: "ok", ...body });
      await db.createPost(row);
      return res.status(200).json(fromRemotePost(row));
    }

    if (p === "/likes") {
      const on = body.on !== false;
      await db.toggleLike(body.post_id, body.user_key, on);
      return res.status(200).json({ ok: true, on });
    }

    if (p === "/comments") {
      const row = {
        id: body.id || "c_" + Date.now(),
        post_id: body.post_id,
        parent_id: body.parent_id || null,
        name: body.name || "",
        user_key: body.user_key || "",
        body: body.body || body.text || "",
        created_at: new Date().toISOString(),
      };
      if (!row.post_id || !row.body) return res.status(400).json({ error: "post_id and body required" });
      await db.createComment(row);
      return res.status(200).json(row);
    }

    if (p === "/products") {
      const row = {
        id: body.id || "pru_" + Date.now(),
        title: body.title,
        price: body.price || 0,
        cat: body.cat || "",
        seller: body.seller || "",
        seller_user: body.seller_user || body.sellerUser || "",
        phone: body.phone || "",
        image_url: body.image_url || body.image || "",
        description: body.description || body.desc || "",
        specs: body.specs || [],
        created_at: new Date().toISOString(),
      };
      if (!row.title) return res.status(400).json({ error: "title required" });
      await db.createProduct(row);
      return res.status(200).json(row);
    }

    if (p === "/messages") {
      const row = {
        id: body.id || "m_" + Date.now(),
        thread_user: body.thread_user,
        from_key: body.from_key || "",
        from_user: body.from_user || "",
        name: body.name || "",
        kind: body.kind || "text",
        body: body.body || body.text || "",
        post_id: body.post_id || null,
        product_id: body.product_id || null,
        image_url: body.image_url || body.image || "",
        created_at: new Date().toISOString(),
      };
      if (!row.thread_user) return res.status(400).json({ error: "thread_user required" });
      await db.createMessage(row);
      return res.status(200).json(row);
    }

    if (p === "/shares") {
      // Shares stored as notes/messages? For now store as report-like
      const row = {
        id: body.id || "sh_" + Date.now(),
        post_id: body.post_id,
        from_key: body.from_key || body.from || "",
        from_name: body.from_name || body.fromName || "",
        to_user: body.to_user || body.to || "",
        preview: body.preview || "",
        created_at: new Date().toISOString(),
      };
      // Store as note for simplicity
      await db.createNote({
        id: row.id,
        dest: row.to_user,
        type: "post",
        title: "شارك منشور",
        body: row.preview,
        from_user: row.from_key,
        from_name: row.from_name,
        post_id: row.post_id,
        created_at: row.created_at,
      }).catch(() => {});
      return res.status(200).json(row);
    }

    if (p === "/follows") {
      const from = String(body.from_user || body.follower || "").toLowerCase();
      const to = String(body.to_user || body.following || "").toLowerCase();
      if (!from || !to) return res.status(400).json({ error: "from/to required" });
      await db.toggleFollow(from, to, body.on !== false);
      return res.status(200).json({ ok: true });
    }

    if (p === "/profiles") {
      if (!body.email && !body.username) return res.status(400).json({ error: "email or username required" });
      const row = {
        id: body.id || undefined,
        email: body.email ? normalizeEmail(body.email) : (body.username + "@zivv.local"),
        username: String(body.username || "").toLowerCase(),
        name: body.name || body.username || "",
        avatar: body.avatar || "",
        cover: body.cover || "",
        bio: body.bio || "",
        city: body.city || "",
        age: body.age || null,
        locked: !!body.locked,
        onboarding: body.onboarding || {},
      };
      const result = await db.upsertProfile(row);
      return res.status(200).json(result && result[0] ? result[0] : row);
    }

    if (p === "/accounts") {
      if (!body.email) return res.status(400).json({ error: "email required" });
      const email = normalizeEmail(body.email);
      let passwordHash = body.password_hash || "";
      if (body.password && !passwordHash) {
        passwordHash = await hashPassword(body.password);
      }
      const row = {
        email,
        username: String(body.username || email.split("@")[0] || "").toLowerCase(),
        first_name: body.first_name || body.first || "",
        last_name: body.last_name || body.last || "",
        name: body.name || "",
        age: body.age || null,
        mark: body.mark || "",
        password: body.password || "", // keep for migration
        password_hash: passwordHash,
        onboarding: body.onboarding || null,
      };
      const result = await db.createAccount(row);
      const safe = { ...row };
      delete safe.password;
      delete safe.password_hash;
      return res.status(200).json(safe);
    }

    if (p === "/reports") {
      const row = {
        id: body.id || "r_" + Date.now(),
        post_id: body.post_id || body.postId || null,
        target_user: body.target_user || body.targetUser || "",
        type: body.type || "post",
        dest: body.dest || "king",
        reporter_name: body.reporter_name || body.reporterName || "",
        reporter_email: body.reporter_email || body.reporterEmail || "",
        note: body.note || "",
        created_at: new Date().toISOString(),
      };
      await db.createReport(row);
      return res.status(200).json(row);
    }

    if (p === "/stories") {
      const row = {
        id: body.id || "st_" + Date.now(),
        username: body.username || body.user || "",
        name: body.name || "",
        avatar: body.avatar || "",
        kind: body.kind || "text",
        body: body.body || body.text || "",
        image_url: body.image_url || body.image || "",
        video_url: body.video_url || body.videoId || "",
        created_at: new Date().toISOString(),
      };
      await db.createStory(row);
      return res.status(200).json(row);
    }

    if (p === "/friends") {
      const row = {
        id: body.id || "fr_" + Date.now(),
        from_user: body.from_user || body.from || "",
        from_name: body.from_name || body.fromName || "",
        to_user: body.to_user || body.to || "",
        to_name: body.to_name || body.toName || "",
        status: body.status || "pending",
        created_at: new Date().toISOString(),
      };
      await db.createFriendReq(row);
      return res.status(200).json(row);
    }

    if (p === "/notes") {
      const row = {
        id: body.id || "n_" + Date.now(),
        dest: body.dest || body.to || "",
        type: body.type || "official",
        title: body.title || "",
        body: body.body || body.text || "",
        from_user: body.from_user || body.from || "",
        from_name: body.from_name || body.fromName || "",
        avatar: body.avatar || "",
        href: body.href || "",
        post_id: body.post_id || body.postId || null,
        unread: body.unread !== false,
        created_at: new Date().toISOString(),
      };
      await db.createNote(row);
      return res.status(200).json(row);
    }

    if (p === "/gold") {
      const row = {
        id: body.id || "g_" + Date.now(),
        username: body.username || body.user || "",
        name: body.name || "",
        status: body.status || "pending",
        note: body.note || "",
        created_at: new Date().toISOString(),
      };
      await db.createGoldReq(row);
      return res.status(200).json(row);
    }

    // AI Chats
    if (p === "/ai-chats") {
      const row = {
        id: body.id || "ai_" + Date.now(),
        user_key: body.user_key || body.user || "",
        title: body.title || "دردشة جديدة",
        model: body.model || "gemini-3.6-flash",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (!row.user_key) return res.status(400).json({ error: "user_key required" });
      await db.upsertAiChat(row);
      return res.status(200).json(row);
    }

    if (p === "/ai-messages") {
      const row = {
        id: body.id || "aim_" + Date.now(),
        chat_id: body.chat_id,
        role: body.role || "user",
        content: body.content || body.text || "",
        image_url: body.image_url || body.image || "",
        sources: body.sources || [],
        created_at: new Date().toISOString(),
      };
      if (!row.chat_id || !row.content) return res.status(400).json({ error: "chat_id and content required" });
      await db.createAiMessage(row);
      // Update chat timestamp
      await db.upsertAiChat({ id: row.chat_id, user_key: body.user_key || "unknown", title: body.chat_title || "دردشة", updated_at: new Date().toISOString() }).catch(() => {});
      return res.status(200).json(row);
    }

    if (p === "/auth/login") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const mark = String(body.mark || "");
      const first = String(body.first || body.first_name || "");
      const last = String(body.last || body.last_name || "");
      const age = String(body.age || "");

      if (!email && (!first || !last)) return res.status(400).json({ error: "email or name required" });

      const accounts = await db.getAccounts();
      let user = null;

      if (email) {
        const acc = accounts.find(a => normalizeEmail(a.email) === email);
        if (acc) {
          const ok = acc.password_hash ? await verifyPassword(password, acc.password_hash) : (String(acc.password) === String(password));
          if (ok) user = acc;
        }
      } else {
        // Legacy login by name+mark+age
        const fold = (s) => String(s || "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
        user = accounts.find(u =>
          fold(u.first_name) === fold(first) &&
          fold(u.last_name) === fold(last) &&
          fold(u.mark) === fold(mark) &&
          String(u.age) === String(age) &&
          (u.password_hash ? true : String(u.password) === String(password))
        );
        if (user && user.password_hash) {
          const ok = await verifyPassword(password, user.password_hash);
          if (!ok) user = null;
        }
      }

      if (!user) return res.status(401).json({ error: "invalid credentials" });

      const { password: pw, password_hash, ...safe } = user;
      return res.status(200).json({ ok: true, user: safe });
    }

    if (p === "/auth/register") {
      const email = normalizeEmail(body.email);
      const username = String(body.username || email.split("@")[0] || "").toLowerCase().trim();
      const password = String(body.password || "");
      if (!email || !password || !username) return res.status(400).json({ error: "email, username, password required" });
      if (password.length < 6) return res.status(400).json({ error: "password too short" });

      const existing = await db.getAccountByEmail(email).catch(() => null);
      if (existing) return res.status(409).json({ error: "email exists" });

      const password_hash = await hashPassword(password);
      const account = {
        email,
        username,
        first_name: body.first_name || body.first || "",
        last_name: body.last_name || body.last || "",
        name: body.name || (body.first_name + " " + body.last_name).trim() || username,
        age: body.age || null,
        mark: body.mark || "",
        password: "", // don't store plain
        password_hash,
        onboarding: body.onboarding || {},
      };
      await db.createAccount(account);

      // Create profile too
      await db.upsertProfile({
        email,
        username,
        name: account.name,
        avatar: body.avatar || "",
        city: body.city || "",
        onboarding: body.onboarding || {},
      }).catch(() => {});

      const { password: pw, password_hash: ph, ...safe } = account;
      return res.status(200).json({ ok: true, user: safe });
    }

    return res.status(404).json({ error: "not found", path: p });
  } catch (err) {
    console.error("[API ERROR]", p, err);
    return res.status(500).json({ error: String(err.message || err), path: p });
  }
};
