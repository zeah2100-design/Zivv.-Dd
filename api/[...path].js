const store = require("../lib/store");
const crypto = require("crypto");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const segs = parts(req);
  const p = "/" + segs.join("/");
  try {
    if (p === "/upload" && req.method === "POST") {
      const body = await readBody(req);
      let raw = String(body.data || "");
      let mime = String(body.mime || "application/octet-stream");
      const m = raw.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        mime = m[1] || mime;
        raw = m[2];
      }
      raw = raw.replace(/\s+/g, "");
      if (!raw) return res.status(400).json({ error: "no data" });
      const buf = Buffer.from(raw, "base64");
      if (!buf.length) return res.status(400).json({ error: "bad data" });
      if (buf.length > 4200000) return res.status(413).json({ error: "file too big" });
      const ext =
        /png/i.test(mime) ? "png" :
        /webp/i.test(mime) ? "webp" :
        /gif/i.test(mime) ? "gif" :
        /webm/i.test(mime) ? "webm" :
        /mp4|quicktime/i.test(mime) ? "mp4" :
        /mpeg|mp3/i.test(mime) ? "mp3" :
        /jpeg|jpg/i.test(mime) ? "jpg" : "bin";
      const base = String(body.name || "f" + Date.now()).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
      const path = "files/" + base + "-" + Date.now().toString(36) + "." + ext;
      const url = await store.uploadFile(path, buf, mime);
      return res.status(200).json({ ok: true, url });
    }

    if (p === "/reset" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.confirm || "") !== "ZIVV-WIPE") return res.status(403).json({ error: "no" });
      await store.save(store.empty());
      return res.status(200).json({ ok: true, wiped: true });
    }

    const db = await store.load();

    if (p === "/health" || p === "/") {
      return res.status(200).json({ ok: true, engine: "supabase-storage", posts: db.posts.length, accounts: db.accounts.length });
    }

    if (p === "/posts" && req.method === "GET") {
      return res.status(200).json(db.posts.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
    }
    if (p === "/posts" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "p" + Date.now(), created_at: Date.now(), status: "ok" }, body);
      db.posts = db.posts.filter((x) => x.id !== row.id);
      db.posts.unshift(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/likes" && req.method === "GET") {
      const postId = (req.query && req.query.post_id) || "";
      const list = postId ? db.likes.filter((x) => x.post_id === postId) : db.likes;
      return res.status(200).json(list);
    }
    if (p === "/likes" && req.method === "POST") {
      const body = await readBody(req);
      const on = body.on !== false;
      db.likes = db.likes.filter((x) => !(x.post_id === body.post_id && x.user_key === body.user_key));
      if (on) db.likes.push({ post_id: body.post_id, user_key: body.user_key, created_at: Date.now() });
      await store.save(db);
      return res.status(200).json({ ok: true, on });
    }

    if (p === "/comments" && req.method === "GET") {
      const postId = (req.query && req.query.post_id) || "";
      const list = postId ? db.comments.filter((x) => x.post_id === postId) : db.comments;
      return res.status(200).json(list);
    }
    if (p === "/comments" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "c_" + Date.now(), created_at: Date.now() }, body);
      db.comments.push(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/products" && req.method === "GET") return res.status(200).json(db.products);
    if (p === "/products" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "pru_" + Date.now(), created_at: Date.now() }, body);
      db.products = db.products.filter((x) => x.id !== row.id);
      db.products.unshift(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/messages" && req.method === "GET") {
      const user = (req.query && req.query.user) || "";
      const list = user ? db.messages.filter((x) => x.thread_user === user) : db.messages;
      return res.status(200).json(list);
    }
    if (p === "/messages" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "m_" + Date.now(), created_at: Date.now() }, body);
      db.messages.push(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/shares" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "sh_" + Date.now(), created_at: Date.now() }, body);
      db.shares.unshift(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/follows" && req.method === "GET") return res.status(200).json(db.follows);
    if (p === "/follows" && req.method === "POST") {
      const body = await readBody(req);
      const from = String(body.from_user || body.follower || "").toLowerCase();
      const to = String(body.to_user || body.following || "").toLowerCase();
      if (!from || !to) return res.status(400).json({ error: "from/to required" });
      db.follows = db.follows.filter((x) => !(x.from_user === from && x.to_user === to) && !(x.follower === from && x.following === to));
      if (body.on !== false) db.follows.push({ from_user: from, to_user: to, follower: from, following: to, created_at: Date.now() });
      await store.save(db);
      return res.status(200).json({ ok: true });
    }

    if (p === "/profiles" && req.method === "GET") return res.status(200).json(db.profiles);
    if (p === "/profiles" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.email && !body.username) return res.status(400).json({ error: "email required" });
      const email = String(body.email || "").toLowerCase();
      const i = db.profiles.findIndex((x) => (email && x.email === email) || (body.username && x.username === body.username));
      const row = Object.assign(i >= 0 ? db.profiles[i] : { id: crypto.randomUUID(), created_at: Date.now() }, body, { email: email || body.email });
      if (i >= 0) db.profiles[i] = row;
      else db.profiles.push(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/accounts" && req.method === "GET") {
      const slim = db.accounts.map((a) => Object.assign({}, a));
      return res.status(200).json(slim);
    }
    if (p === "/accounts" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.email) return res.status(400).json({ error: "email required" });
      const email = String(body.email).toLowerCase();
      const row = Object.assign({ created_at: Date.now() }, body, { email });
      db.accounts = db.accounts.filter((x) => x.email !== email);
      db.accounts.push(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/reports" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "r_" + Date.now(), created_at: Date.now() }, body);
      db.reports.unshift(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/stories" && req.method === "GET") return res.status(200).json(db.stories);
    if (p === "/stories" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "st_" + Date.now(), created_at: Date.now() }, body);
      db.stories = db.stories.filter((x) => x.id !== row.id);
      db.stories.unshift(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/friends" && req.method === "GET") return res.status(200).json(db.friendReqs);
    if (p === "/friends" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "fr_" + Date.now(), created_at: Date.now() }, body);
      db.friendReqs = db.friendReqs.filter((x) => x.id !== row.id);
      db.friendReqs.unshift(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/notes" && req.method === "GET") return res.status(200).json(db.notes);
    if (p === "/notes" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "n_" + Date.now(), created_at: Date.now() }, body);
      db.notes.unshift(row);
      db.notes = db.notes.slice(0, 200);
      await store.save(db);
      return res.status(200).json(row);
    }

    if (p === "/gold" && req.method === "GET") return res.status(200).json(db.goldReqs);
    if (p === "/gold" && req.method === "POST") {
      const body = await readBody(req);
      const row = Object.assign({ id: "g_" + Date.now(), created_at: Date.now() }, body);
      db.goldReqs = db.goldReqs.filter((x) => x.id !== row.id);
      db.goldReqs.unshift(row);
      await store.save(db);
      return res.status(200).json(row);
    }

    return res.status(404).json({ error: "not found", path: p });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
};
