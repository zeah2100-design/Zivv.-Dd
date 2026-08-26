"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const { URL } = require("url");
const { getConfig } = require("./lib/config");
const { getDatabase } = require("./lib/database");
const { hashPassword, verifyPassword, normalizeEmail } = require("./lib/auth");

const cfg = getConfig();
const ROOT = __dirname;
const PORT = cfg.port;

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".md": "text/markdown; charset=utf-8",
    ".sql": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
  }[ext] || "application/octet-stream");
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  if (rel.startsWith("/data/") || rel === "/data") {
    res.writeHead(403); return res.end("forbidden");
  }
  if (rel.startsWith("/uploads/")) {
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": mime(file), "Cache-Control": "public, max-age=31536000" });
    fs.createReadStream(file).pipe(res);
    return;
  }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": mime(file) });
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, url) {
  const p = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return json(res, 204, {});
  const db = getDatabase();

  try {
    // Health
    if (p === "/api/health" && req.method === "GET") {
      const posts = await db.getPosts(1).catch(() => []);
      const accounts = await db.getAccounts().catch(() => []);
      return json(res, 200, { ok: true, engine: "real-database", mode: db.mode, real: true, posts: posts.length, accounts: accounts.length, timestamp: new Date().toISOString(), social: true, message: "موقع تواصل اجتماعي بقاعدة بيانات حقيقية 100%" });
    }

    // Search
    if (p === "/api/search" && req.method === "GET") {
      const q = String(url.searchParams.get("q") || "").trim().slice(0, 200);
      if (!q) return json(res, 400, { error: "q required" });
      const items = [];
      try {
        const ddg = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers: { "User-Agent": "Mozilla/5.0 ZIVV" }, signal: AbortSignal.timeout(12000) });
        const html = await ddg.text();
        const blocks = html.split('class="result__a"').slice(1, 7);
        blocks.forEach((b) => {
          const href = (b.match(/uddg=([^&"']+)/) || [])[1];
          const title = (b.match(/>([\s\S]*?)<\/a>/) || [])[1] || "";
          const snip = (b.match(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)/) || [])[1] || "";
          const clean = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
          const t = clean(title);
          if (!t) return;
          items.push({ title: t.slice(0, 140), snippet: clean(snip).slice(0, 240), url: href ? decodeURIComponent(href) : "" });
        });
      } catch {}
      return json(res, 200, { q, items: items.slice(0, 10) });
    }

    if (p === "/api/read" && req.method === "GET") {
      const target = String(url.searchParams.get("url") || "").trim();
      if (!/^https?:\/\//i.test(target)) return json(res, 400, { error: "bad url" });
      try {
        const r = await fetch("https://r.jina.ai/" + target, { headers: { "User-Agent": "Mozilla/5.0 ZIVV" }, signal: AbortSignal.timeout(15000) });
        const text = (await r.text()).replace(/\s+/g, " ").trim().slice(0, 2800);
        return json(res, 200, { url: target, text });
      } catch (e) { return json(res, 502, { error: String(e.message || e) }); }
    }

    // GET routes
    if (req.method === "GET") {
      if (p === "/api/posts") {
        const limit = Number(url.searchParams.get("limit") || 250);
        const rows = await db.getPosts(limit);
        return json(res, 200, rows.map(r => ({
          id: r.id, name: r.name, user: r.username || r.user, username: r.username,
          avatar: r.avatar || r.image_url || "brand/logo-sm.png",
          title: r.title || "", text: r.body || r.text || "", body: r.body || "",
          type: r.type || "text", videoKind: r.video_kind || r.videoKind || "",
          tags: typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : (r.tags || []),
          dests: typeof r.dests === "string" ? JSON.parse(r.dests || "[]") : (r.dests || []),
          image: r.image_url || r.image || "", videoId: r.video_url || r.videoId || "",
          audioId: r.audio_url || r.audioId || "", status: r.status || "ok",
          created_at: r.created_at
        })));
      }
      if (p === "/api/likes") {
        const postId = url.searchParams.get("post_id") || "";
        const list = await db.getLikes(postId || null);
        return json(res, 200, list);
      }
      if (p === "/api/comments") {
        const postId = url.searchParams.get("post_id") || "";
        const list = await db.getComments(postId || null);
        return json(res, 200, list);
      }
      if (p === "/api/products") return json(res, 200, await db.getProducts());
      if (p === "/api/messages") {
        const user = url.searchParams.get("user") || "";
        return json(res, 200, await db.getMessages(user || null));
      }
      if (p === "/api/follows") return json(res, 200, await db.getFollows());
      if (p === "/api/profiles") return json(res, 200, await db.getProfiles());
      if (p === "/api/accounts") {
        const rows = await db.getAccounts();
        const safe = rows.map(r => { const { password, password_hash, ...rest } = r; return rest; });
        return json(res, 200, safe);
      }
      if (p === "/api/stories") return json(res, 200, await db.getStories());
      if (p === "/api/friends") return json(res, 200, await db.getFriendReqs());
      if (p === "/api/notes") {
        const dest = url.searchParams.get("dest") || "";
        return json(res, 200, await db.getNotes(dest || null));
      }
      if (p === "/api/gold") return json(res, 200, await db.getGoldReqs());
      if (p === "/api/reports") return json(res, 200, await db.getReports());
      if (p === "/api/ai-chats") {
        const user = url.searchParams.get("user") || "";
        if (!user) return json(res, 400, { error: "user required" });
        return json(res, 200, await db.getAiChats(user));
      }
      if (p === "/api/ai-messages") {
        const chatId = url.searchParams.get("chat_id") || "";
        if (!chatId) return json(res, 400, { error: "chat_id required" });
        return json(res, 200, await db.getAiMessages(chatId));
      }
      return json(res, 404, { error: "not found", path: p });
    }

    // POST routes
    if (req.method === "POST") {
      const body = await readBody(req);

      if (p === "/api/posts") {
        const row = {
          id: body.id || `p${Date.now()}`,
          username: body.username || body.user || "",
          name: body.name || "",
          avatar: body.avatar || "",
          title: body.title || "",
          body: body.body || body.text || "",
          type: body.type || "text",
          video_kind: body.video_kind || body.videoKind || "",
          tags: body.tags || [],
          dests: body.dests || [],
          image_url: body.image_url || body.image || "",
          video_url: body.video_url || body.videoId || "",
          audio_url: body.audio_url || body.audioId || "",
          sound_url: body.sound_url || body.soundId || "",
          mute_original: !!body.mute_original,
          link: body.link || "",
          place: body.place || "",
          status: body.status || "ok",
          visibility: body.visibility || "",
          priv: !!body.priv,
          created_at: body.created_at || new Date().toISOString()
        };
        await db.createPost(row);
        return json(res, 200, row);
      }

      if (p === "/api/likes") {
        await db.toggleLike(body.post_id, body.user_key, body.on !== false);
        return json(res, 200, { ok: true, on: body.on !== false });
      }

      if (p === "/api/comments") {
        const row = {
          id: body.id || `c_${Date.now()}`,
          post_id: body.post_id,
          parent_id: body.parent_id || null,
          name: body.name || "",
          user_key: body.user_key || "",
          body: body.body || body.text || "",
          created_at: new Date().toISOString()
        };
        await db.createComment(row);
        return json(res, 200, row);
      }

      if (p === "/api/products") {
        const row = { id: body.id || `pru_${Date.now()}`, title: body.title, price: body.price || 0, cat: body.cat || "", seller: body.seller || "", seller_user: body.seller_user || body.sellerUser || "", phone: body.phone || "", image_url: body.image_url || body.image || "", description: body.description || body.desc || "", specs: body.specs || [], created_at: new Date().toISOString() };
        await db.createProduct(row);
        return json(res, 200, row);
      }

      if (p === "/api/messages") {
        const row = { id: body.id || `m_${Date.now()}`, thread_user: body.thread_user, from_key: body.from_key || "", from_user: body.from_user || "", name: body.name || "", kind: body.kind || "text", body: body.body || body.text || "", post_id: body.post_id || null, image_url: body.image_url || body.image || "", created_at: new Date().toISOString() };
        await db.createMessage(row);
        return json(res, 200, row);
      }

      if (p === "/api/follows") {
        const from = String(body.from_user || body.follower || "").toLowerCase();
        const to = String(body.to_user || body.following || "").toLowerCase();
        if (!from || !to) return json(res, 400, { error: "from/to required" });
        await db.toggleFollow(from, to, body.on !== false);
        return json(res, 200, { ok: true });
      }

      if (p === "/api/profiles") {
        const row = { email: body.email ? normalizeEmail(body.email) : `${body.username}@zivv.local`, username: String(body.username || "").toLowerCase(), name: body.name || body.username || "", avatar: body.avatar || "", cover: body.cover || "", bio: body.bio || "", city: body.city || "", age: body.age || null, locked: !!body.locked, onboarding: body.onboarding || {} };
        const result = await db.upsertProfile(row);
        return json(res, 200, result && result[0] ? result[0] : row);
      }

      if (p === "/api/accounts") {
        const email = normalizeEmail(body.email);
        let hash = body.password_hash || "";
        if (body.password && !hash) hash = await hashPassword(body.password);
        const row = { email, username: String(body.username || email.split("@")[0] || "").toLowerCase(), first_name: body.first_name || body.first || "", last_name: body.last_name || body.last || "", name: body.name || "", age: body.age || null, mark: body.mark || "", password_hash: hash, onboarding: body.onboarding || null };
        await db.createAccount(row);
        const { password, password_hash, ...safe } = row;
        return json(res, 200, safe);
      }

      if (p === "/api/auth/register") {
        const email = normalizeEmail(body.email);
        const username = String(body.username || email.split("@")[0] || "").toLowerCase().trim();
        const password = String(body.password || "");
        if (!email || !password || !username) return json(res, 400, { error: "email, username, password required" });
        if (password.length < 6) return json(res, 400, { error: "password too short (min 6)" });
        const existing = await db.getAccountByEmail(email).catch(() => null);
        if (existing) return json(res, 409, { error: "email exists - البريد موجود" });
        const password_hash = await hashPassword(password);
        const account = { email, username, first_name: body.first_name || "", last_name: body.last_name || "", name: body.name || username, age: body.age || null, mark: body.mark || "", password_hash, onboarding: body.onboarding || {} };
        await db.createAccount(account);
        await db.upsertProfile({ email, username, name: account.name, avatar: body.avatar || "", city: body.city || "", onboarding: body.onboarding || {} }).catch(() => {});
        const { password: pw, password_hash: ph, ...safe } = account;
        return json(res, 200, { ok: true, user: safe, real: true, message: "حساب حقيقي محفوظ في قاعدة البيانات" });
      }

      if (p === "/api/auth/login") {
        const email = normalizeEmail(body.email);
        const password = String(body.password || "");
        if (!email || !password) return json(res, 400, { error: "email and password required" });
        const acc = await db.getAccountByEmail(email).catch(() => null);
        if (!acc) {
          // Try list fallback
          const all = await db.getAccounts().catch(() => []);
          const found = all.find(a => normalizeEmail(a.email) === email);
          if (!found) return json(res, 401, { error: "invalid credentials - بيانات خاطئة" });
          const ok = found.password_hash ? await verifyPassword(password, found.password_hash) : String(found.password) === String(password);
          if (!ok) return json(res, 401, { error: "invalid credentials" });
          const { password: pw, password_hash, ...safe } = found;
          return json(res, 200, { ok: true, user: safe, real: true });
        }
        const ok = acc.password_hash ? await verifyPassword(password, acc.password_hash) : String(acc.password) === String(password);
        if (!ok) return json(res, 401, { error: "invalid credentials - كلمة المرور خاطئة" });
        const { password: pw, password_hash, ...safe } = acc;
        return json(res, 200, { ok: true, user: safe, real: true, message: "دخول حقيقي من قاعدة البيانات" });
      }

      if (p === "/api/stories") {
        const row = { id: body.id || `st_${Date.now()}`, username: body.username || body.user || "", name: body.name || "", avatar: body.avatar || "", kind: body.kind || "text", body: body.body || body.text || "", image_url: body.image_url || body.image || "", video_url: body.video_url || body.videoId || "", created_at: new Date().toISOString() };
        await db.createStory(row);
        return json(res, 200, row);
      }

      if (p === "/api/friends") {
        const row = { id: body.id || `fr_${Date.now()}`, from_user: body.from_user || body.from || "", from_name: body.from_name || body.fromName || "", to_user: body.to_user || body.to || "", to_name: body.to_name || body.toName || "", status: body.status || "pending", created_at: new Date().toISOString() };
        await db.createFriendReq(row);
        return json(res, 200, row);
      }

      if (p === "/api/notes") {
        const row = { id: body.id || `n_${Date.now()}`, dest: body.dest || body.to || "", type: body.type || "official", title: body.title || "", body: body.body || body.text || "", from_user: body.from_user || body.from || "", from_name: body.from_name || body.fromName || "", avatar: body.avatar || "", href: body.href || "", post_id: body.post_id || body.postId || null, unread: body.unread !== false, created_at: new Date().toISOString() };
        await db.createNote(row);
        return json(res, 200, row);
      }

      if (p === "/api/gold") {
        const row = { id: body.id || `g_${Date.now()}`, username: body.username || body.user || "", name: body.name || "", status: body.status || "pending", note: body.note || "", created_at: new Date().toISOString() };
        await db.createGoldReq(row);
        return json(res, 200, row);
      }

      if (p === "/api/reports") {
        const row = { id: body.id || `r_${Date.now()}`, post_id: body.post_id || body.postId || null, target_user: body.target_user || body.targetUser || "", type: body.type || "post", dest: body.dest || "king", reporter_name: body.reporter_name || body.reporterName || "", reporter_email: body.reporter_email || body.reporterEmail || "", note: body.note || "", created_at: new Date().toISOString() };
        await db.createReport(row);
        return json(res, 200, row);
      }

      if (p === "/api/ai-chats") {
        const row = { id: body.id || `ai_${Date.now()}`, user_key: body.user_key || body.user || "", title: body.title || "دردشة جديدة", model: body.model || "gemini-3.6-flash", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        await db.upsertAiChat(row);
        return json(res, 200, row);
      }

      if (p === "/api/ai-messages") {
        const row = { id: body.id || `aim_${Date.now()}`, chat_id: body.chat_id, role: body.role || "user", content: body.content || body.text || "", image_url: body.image_url || body.image || "", sources: body.sources || [], created_at: new Date().toISOString() };
        await db.createAiMessage(row);
        return json(res, 200, row);
      }

      if (p === "/api/upload") {
        let raw = String(body.data || "");
        let mimeType = String(body.mime || "application/octet-stream");
        const m = raw.match(/^data:([^;]+);base64,(.+)$/);
        if (m) { mimeType = m[1] || mimeType; raw = m[2]; }
        raw = raw.replace(/\s+/g, "");
        if (!raw) return json(res, 400, { error: "no data" });
        const buf = Buffer.from(raw, "base64");
        if (buf.length > 10000000) return json(res, 413, { error: "file too big" });
        const ext = /png/i.test(mimeType) ? "png" : /webp/i.test(mimeType) ? "webp" : /mp4/i.test(mimeType) ? "mp4" : /jpeg|jpg/i.test(mimeType) ? "jpg" : "bin";
        const base = String(body.name || `f${Date.now()}`).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
        const filePath = `files/${base}-${Date.now().toString(36)}.${ext}`;
        const url = await db.uploadFile(filePath, buf, mimeType);
        return json(res, 200, { ok: true, url, real: true });
      }

      if (p === "/api/ai" && req.method === "POST") {
        const messages = Array.isArray(body.messages) ? body.messages.slice(-18) : [];
        const key = String(body.key || cfg.ai.cometKey || "").trim();
        let last = "ai unavailable";
        if (key) {
          try {
            const sys = messages.find(m => m.role === "system");
            const contents = messages.filter(m => m && m.role !== "system" && m.content).map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }));
            const payload = { contents: contents.length ? contents : [{ parts: [{ text: "مرحبا" }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 4096 } };
            if (sys && sys.content) payload.systemInstruction = { parts: [{ text: String(sys.content) }] };
            const r = await fetch(`https://api.cometapi.com/v1beta/models/${encodeURIComponent(body.model || cfg.ai.cometModel)}:generateContent`, {
              method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(28000)
            });
            const raw = await r.text();
            let data = raw;
            try { data = JSON.parse(raw); } catch {}
            if (r.ok) {
              const parts = data?.candidates?.[0]?.content?.parts;
              const text = Array.isArray(parts) ? parts.map(p => p.text || "").join("") : "";
              if (text.trim()) return json(res, 200, { text: text.trim(), choices: [{ message: { content: text.trim() } }] });
            } else last = (data?.error?.message) || raw.slice(0, 200);
          } catch (e) { last = String(e.message || e); }
        }
        try {
          const r = await fetch("https://text.pollinations.ai/openai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai", messages, stream: false }), signal: AbortSignal.timeout(16000) });
          const raw = await r.text();
          if (r.ok) {
            let data = raw;
            try { data = JSON.parse(raw); } catch {}
            return json(res, 200, typeof data === "string" ? { text: data } : data);
          }
        } catch (e) { last = String(e.message || e); }
        return json(res, 502, { error: last });
      }

      return json(res, 404, { error: "not found", path: p });
    }
  } catch (err) {
    console.error("[API ERROR]", p, err);
    return json(res, 500, { error: String(err.message || err), path: p });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error("[SERVER ERROR]", err);
    json(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ ZIVV موقع تواصل اجتماعي - قاعدة بيانات حقيقية 100%`);
  console.log(`📦 Mode: ${getDatabase().mode} - ${getDatabase().mode === 'sqlite' ? 'SQLite ملف حقيقي' : 'Supabase Postgres'}`);
  console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
  console.log(`💾 Real DB: posts, accounts, likes, comments, follows, messages, stories, ai_chats...`);
});
