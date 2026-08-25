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
      await store.update((db) => {
        const blank = store.empty();
        Object.keys(blank).forEach((k) => { db[k] = blank[k]; });
      });
      return res.status(200).json({ ok: true, wiped: true });
    }

    if (req.method === "GET") {
      const db = await store.load();
      if (p === "/health" || p === "/") {
        return res.status(200).json({ ok: true, engine: "supabase-storage", posts: db.posts.length, accounts: db.accounts.length });
      }
      if (p === "/posts") {
        return res.status(200).json(db.posts.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
      }
      if (p === "/likes") {
        const postId = (req.query && req.query.post_id) || "";
        const list = postId ? db.likes.filter((x) => x.post_id === postId) : db.likes;
        return res.status(200).json(list);
      }
      if (p === "/comments") {
        const postId = (req.query && req.query.post_id) || "";
        const list = postId ? db.comments.filter((x) => x.post_id === postId) : db.comments;
        return res.status(200).json(list);
      }
      if (p === "/products") return res.status(200).json(db.products);
      if (p === "/messages") {
        const user = (req.query && req.query.user) || "";
        const list = user ? db.messages.filter((x) => x.thread_user === user) : db.messages;
        return res.status(200).json(list);
      }
      if (p === "/follows") return res.status(200).json(db.follows);
      if (p === "/profiles") return res.status(200).json(db.profiles);
      if (p === "/accounts") {
        const slim = db.accounts.map((a) => Object.assign({}, a));
        return res.status(200).json(slim);
      }
      if (p === "/stories") return res.status(200).json(db.stories);
      if (p === "/friends") return res.status(200).json(db.friendReqs);
      if (p === "/notes") return res.status(200).json(db.notes);
      if (p === "/gold") return res.status(200).json(db.goldReqs);
      return res.status(404).json({ error: "not found", path: p });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "method" });
    const body = await readBody(req);

    if (p === "/posts") {
      const row = Object.assign({ id: "p" + Date.now(), created_at: Date.now(), status: "ok" }, body);
      await store.update((db) => {
        db.posts = db.posts.filter((x) => x.id !== row.id);
        db.posts.unshift(row);
      });
      return res.status(200).json(row);
    }

    if (p === "/likes") {
      const on = body.on !== false;
      await store.update((db) => {
        db.likes = db.likes.filter((x) => !(x.post_id === body.post_id && x.user_key === body.user_key));
        if (on) db.likes.push({ post_id: body.post_id, user_key: body.user_key, created_at: Date.now() });
      });
      return res.status(200).json({ ok: true, on });
    }

    if (p === "/comments") {
      const row = Object.assign({ id: "c_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => { db.comments.push(row); });
      return res.status(200).json(row);
    }

    if (p === "/products") {
      const row = Object.assign({ id: "pru_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => {
        db.products = db.products.filter((x) => x.id !== row.id);
        db.products.unshift(row);
      });
      return res.status(200).json(row);
    }

    if (p === "/messages") {
      const row = Object.assign({ id: "m_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => { db.messages.push(row); });
      return res.status(200).json(row);
    }

    if (p === "/shares") {
      const row = Object.assign({ id: "sh_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => { db.shares.unshift(row); });
      return res.status(200).json(row);
    }

    if (p === "/follows") {
      const from = String(body.from_user || body.follower || "").toLowerCase();
      const to = String(body.to_user || body.following || "").toLowerCase();
      if (!from || !to) return res.status(400).json({ error: "from/to required" });
      await store.update((db) => {
        db.follows = db.follows.filter((x) => !(x.from_user === from && x.to_user === to) && !(x.follower === from && x.following === to));
        if (body.on !== false) db.follows.push({ from_user: from, to_user: to, follower: from, following: to, created_at: Date.now() });
      });
      return res.status(200).json({ ok: true });
    }

    if (p === "/profiles") {
      if (!body.email && !body.username) return res.status(400).json({ error: "email required" });
      const email = String(body.email || "").toLowerCase();
      const row = await store.update((db) => {
        const i = db.profiles.findIndex((x) => (email && x.email === email) || (body.username && x.username === body.username));
        const next = Object.assign(i >= 0 ? db.profiles[i] : { id: crypto.randomUUID(), created_at: Date.now() }, body, { email: email || body.email });
        if (i >= 0) db.profiles[i] = next;
        else db.profiles.push(next);
        return next;
      });
      return res.status(200).json(row);
    }

    if (p === "/accounts") {
      if (!body.email) return res.status(400).json({ error: "email required" });
      const email = String(body.email).toLowerCase();
      const row = Object.assign({ created_at: Date.now() }, body, { email });
      await store.update((db) => {
        db.accounts = db.accounts.filter((x) => x.email !== email);
        db.accounts.push(row);
      });
      return res.status(200).json(row);
    }

    if (p === "/reports") {
      const row = Object.assign({ id: "r_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => { db.reports.unshift(row); });
      return res.status(200).json(row);
    }

    if (p === "/stories") {
      const row = Object.assign({ id: "st_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => {
        db.stories = db.stories.filter((x) => x.id !== row.id);
        db.stories.unshift(row);
      });
      return res.status(200).json(row);
    }

    if (p === "/friends") {
      const row = Object.assign({ id: "fr_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => {
        db.friendReqs = db.friendReqs.filter((x) => x.id !== row.id);
        db.friendReqs.unshift(row);
      });
      return res.status(200).json(row);
    }

    if (p === "/notes") {
      const row = Object.assign({ id: "n_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => {
        db.notes.unshift(row);
        db.notes = db.notes.slice(0, 200);
      });
      return res.status(200).json(row);
    }

    if (p === "/gold") {
      const row = Object.assign({ id: "g_" + Date.now(), created_at: Date.now() }, body);
      await store.update((db) => {
        db.goldReqs = db.goldReqs.filter((x) => x.id !== row.id);
        db.goldReqs.unshift(row);
      });
      return res.status(200).json(row);
    }

    return res.status(404).json({ error: "not found", path: p });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
};
