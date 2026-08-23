"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "zivv.json");
const PORT = Number(process.env.PORT || 8787);

function emptyDb() {
  return {
    profiles: [],
    posts: [],
    likes: [],
    comments: [],
    commentLikes: [],
    follows: [],
    shares: [],
    messages: [],
    products: [],
    reports: [],
    stories: [],
    users: [],
  };
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try {
    return Object.assign(emptyDb(), JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
  } catch {
    return emptyDb();
  }
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 0));
}

let db = load();

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    {
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
    }[ext] || "application/octet-stream"
  );
}

const SECRET_FILE = path.join(DATA_DIR, "ai-secret.json");
function loadSecret() {
  try {
    return JSON.parse(fs.readFileSync(SECRET_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  if (rel === "/data" || rel.startsWith("/data/")) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": mime(file) });
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, url) {
  const p = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return json(res, 204, {});

  if (p === "/api/health" && req.method === "GET") {
    return json(res, 200, { ok: true, engine: "zivv-json", posts: db.posts.length });
  }

  if (p === "/api/search" && req.method === "GET") {
    const q = String(url.searchParams.get("q") || "").trim().slice(0, 200);
    if (!q) return json(res, 400, { error: "q required" });
    const items = [];
    try {
      const ddg = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), {
        headers: { "User-Agent": "Mozilla/5.0 ZIVV" },
        signal: AbortSignal.timeout(12000),
      });
      const html = await ddg.text();
      const blocks = html.split('class="result__a"').slice(1, 7);
      blocks.forEach((b) => {
        const href = (b.match(/uddg=([^&"']+)/) || [])[1];
        const title = (b.match(/>([\s\S]*?)<\/a>/) || [])[1] || "";
        const snip = (b.match(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)/) || [])[1] || "";
        const clean = (s) =>
          String(s || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/\s+/g, " ")
            .trim();
        const t = clean(title);
        if (!t) return;
        items.push({
          title: t.slice(0, 140),
          snippet: clean(snip).slice(0, 240),
          url: href ? decodeURIComponent(href) : "",
        });
      });
    } catch {}
    try {
      const wiki = await fetch(
        "https://ar.wikipedia.org/w/api.php?action=query&list=search&utf8=1&format=json&srlimit=3&srsearch=" +
          encodeURIComponent(q),
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await wiki.json();
      (data.query && data.query.search ? data.query.search : []).forEach((s) => {
        items.push({
          title: s.title,
          snippet: String(s.snippet || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          url: "https://ar.wikipedia.org/wiki/" + encodeURIComponent(s.title),
        });
      });
    } catch {}
    try {
      const rss = await fetch(
        "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=ar&gl=EG&ceid=EG:ar",
        { headers: { "User-Agent": "Mozilla/5.0 ZIVV" }, signal: AbortSignal.timeout(10000) }
      );
      const xml = await rss.text();
      const bits = xml.split("<item>").slice(1, 6);
      bits.forEach((b) => {
        const title = ((b.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || b.match(/<title>(.*?)<\/title>/) || [])[1] || "").trim();
        const link = ((b.match(/<link>(.*?)<\/link>/) || [])[1] || "").trim();
        const src = ((b.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || "").trim();
        if (title) items.unshift({ title: title.slice(0, 160), snippet: src || "خبر", url: link });
      });
    } catch {}
    return json(res, 200, { q, items: items.slice(0, 10) });
  }

  if (p === "/api/read" && req.method === "GET") {
    const target = String(url.searchParams.get("url") || "").trim();
    if (!/^https?:\/\//i.test(target)) return json(res, 400, { error: "bad url" });
    try {
      const r = await fetch("https://r.jina.ai/" + target, {
        headers: { "User-Agent": "Mozilla/5.0 ZIVV", Accept: "text/plain" },
        signal: AbortSignal.timeout(15000),
      });
      const text = (await r.text()).replace(/\s+/g, " ").trim().slice(0, 2800);
      return json(res, 200, { url: target, text });
    } catch (e) {
      return json(res, 502, { error: String(e.message || e) });
    }
  }

  if (p === "/api/posts" && req.method === "GET") {
    return json(res, 200, db.posts.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
  }
  if (p === "/api/posts" && req.method === "POST") {
    const body = await readBody(req);
    const row = Object.assign(
      { id: "p" + Date.now(), created_at: Date.now(), status: "ok" },
      body
    );
    db.posts = db.posts.filter((x) => x.id !== row.id);
    db.posts.unshift(row);
    save(db);
    return json(res, 200, row);
  }

  if (p === "/api/likes" && req.method === "GET") {
    const postId = url.searchParams.get("post_id");
    const list = postId ? db.likes.filter((x) => x.post_id === postId) : db.likes;
    return json(res, 200, list);
  }
  if (p === "/api/likes" && req.method === "POST") {
    const body = await readBody(req);
    const on = body.on !== false;
    db.likes = db.likes.filter((x) => !(x.post_id === body.post_id && x.user_key === body.user_key));
    if (on) db.likes.push({ post_id: body.post_id, user_key: body.user_key, created_at: Date.now() });
    save(db);
    return json(res, 200, { ok: true, on });
  }

  if (p === "/api/comments" && req.method === "GET") {
    const postId = url.searchParams.get("post_id");
    const list = postId ? db.comments.filter((x) => x.post_id === postId) : db.comments;
    return json(res, 200, list);
  }
  if (p === "/api/comments" && req.method === "POST") {
    const body = await readBody(req);
    const row = Object.assign({ id: "c_" + Date.now(), created_at: Date.now() }, body);
    db.comments.push(row);
    save(db);
    return json(res, 200, row);
  }

  if (p === "/api/products" && req.method === "GET") {
    return json(res, 200, db.products);
  }
  if (p === "/api/products" && req.method === "POST") {
    const body = await readBody(req);
    const row = Object.assign({ id: "pru_" + Date.now(), created_at: Date.now() }, body);
    db.products = db.products.filter((x) => x.id !== row.id);
    db.products.unshift(row);
    save(db);
    return json(res, 200, row);
  }

  if (p === "/api/messages" && req.method === "GET") {
    const user = url.searchParams.get("user");
    const list = user ? db.messages.filter((x) => x.thread_user === user) : db.messages;
    return json(res, 200, list);
  }
  if (p === "/api/messages" && req.method === "POST") {
    const body = await readBody(req);
    const row = Object.assign({ id: "m_" + Date.now(), created_at: Date.now() }, body);
    db.messages.push(row);
    save(db);
    return json(res, 200, row);
  }

  if (p === "/api/shares" && req.method === "POST") {
    const body = await readBody(req);
    const row = Object.assign({ id: "sh_" + Date.now(), created_at: Date.now() }, body);
    db.shares.unshift(row);
    save(db);
    return json(res, 200, row);
  }

  if (p === "/api/profiles" && req.method === "GET") {
    return json(res, 200, db.profiles);
  }
  if (p === "/api/profiles" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.email) return json(res, 400, { error: "email required" });
    const email = String(body.email).toLowerCase();
    const i = db.profiles.findIndex((x) => x.email === email);
    const row = Object.assign(
      i >= 0 ? db.profiles[i] : { id: crypto.randomUUID(), created_at: Date.now() },
      body,
      { email }
    );
    if (i >= 0) db.profiles[i] = row;
    else db.profiles.push(row);
    save(db);
    return json(res, 200, row);
  }

  if (p === "/api/reports" && req.method === "POST") {
    const body = await readBody(req);
    const row = Object.assign({ id: "r_" + Date.now(), created_at: Date.now() }, body);
    db.reports.unshift(row);
    save(db);
    return json(res, 200, row);
  }

  if (p === "/api/ai" && req.method === "POST") {
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-18) : [];
    const secret = loadSecret();
    const userKey = String(body.key || "").trim();
    const provider = String(body.provider || secret.provider || "bytez").toLowerCase();
    let last = "ai unavailable";

    async function callComet(key, model) {
      const mid = model || "gemini-3.6-flash";
      const sys = messages.find((m) => m.role === "system");
      const contents = messages
        .filter((m) => m && m.role !== "system" && m.content)
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.content) }],
        }));
      try {
        const payload = {
          contents: contents.length ? contents : [{ parts: [{ text: "مرحبا" }] }],
          generationConfig: { maxOutputTokens: 4096 },
        };
        if (sys && sys.content) payload.systemInstruction = { parts: [{ text: String(sys.content) }] };
        const r = await fetch(
          "https://api.cometapi.com/v1beta/models/" + encodeURIComponent(mid) + ":generateContent",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(28000),
          }
        );
        const raw = await r.text();
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch {}
        if (r.ok) {
          const parts =
            data &&
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts;
          const text = Array.isArray(parts)
            ? parts.map((p) => p.text || "").join("")
            : "";
          if (text.trim()) return { text: text.trim() };
        } else {
          last =
            (data && data.error && (data.error.message || data.error)) ||
            raw.slice(0, 200) ||
            "HTTP " + r.status;
        }
      } catch (e) {
        last = String(e.message || e);
      }
      try {
        const got = await callOpenAI("https://api.cometapi.com/v1/chat/completions", key, mid);
        if (got) return got;
      } catch (e) {
        last = String(e.message || e);
      }
      return null;
    }

    async function callBytez(key, model) {
      const mid = model || "Qwen/Qwen3-4B";
      const auth = "Key " + key;
      const tries = [
        {
          url: "https://api.bytez.com/models/v2/openai/v1/chat/completions",
          body: { model: mid, messages: messages, stream: false, max_tokens: 800 },
        },
        {
          url: "https://api.bytez.com/models/v2/" + mid,
          body: { messages: messages, params: { max_new_tokens: 400, temperature: 0.7 } },
        },
      ];
      for (const t of tries) {
        try {
          const r = await fetch(t.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify(t.body),
            signal: AbortSignal.timeout(10000),
          });
          const raw = await r.text();
          let data = raw;
          try {
            data = JSON.parse(raw);
          } catch {}
          if (data && data.error) {
            last = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
            continue;
          }
          if (!r.ok) {
            last = raw.slice(0, 200) || "HTTP " + r.status;
            continue;
          }
          if (data && data.output != null) {
            const out = data.output;
            if (typeof out === "string") return { text: out };
            if (out && out.content) return { text: String(out.content) };
            if (out && out.text) return { text: String(out.text) };
          }
          if (data && data.choices) return data;
          if (typeof data === "string" && data.trim()) return { text: data };
        } catch (e) {
          last = String(e.message || e);
        }
      }
      return null;
    }

    async function callOpenAI(url, key, model, extraHeaders) {
      const r = await fetch(url, {
        method: "POST",
        headers: Object.assign(
          {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          extraHeaders || {}
        ),
        body: JSON.stringify({ model: model, messages: messages, stream: false, max_tokens: 4096 }),
        signal: AbortSignal.timeout(28000),
      });
      const raw = await r.text();
      let data = raw;
      try {
        data = JSON.parse(raw);
      } catch {}
      if (!r.ok) {
        last =
          (data && data.error && (data.error.message || data.error)) ||
          raw.slice(0, 200) ||
          "HTTP " + r.status;
        return null;
      }
      return typeof data === "string" ? { text: data } : data;
    }

    const cometKey = userKey || secret.key || "";
    if (cometKey) {
      try {
        const got = await callComet(cometKey, body.model || secret.model || "gemini-3.6-flash");
        if (got) return json(res, 200, got);
      } catch (e) {
        last = String(e.message || e);
      }
    }

    const bytezKey = provider === "bytez" ? userKey || secret.key : secret.provider === "bytez" ? secret.key : "";
    if (bytezKey) {
      try {
        const got = await callBytez(bytezKey, body.model || secret.model || "Qwen/Qwen3-4B");
        if (got) return json(res, 200, got);
      } catch (e) {
        last = String(e.message || e);
      }
    }

    try {
      const llmKey = userKey || secret.key || "anonymous";
      const llmModel =
        body.model && !/gpt-4o|claude-3.5|llama-3.3|gemini-2.0$/.test(String(body.model))
          ? body.model
          : "DeepSeek-V4-Flash-0731";
      const got = await callOpenAI("https://api.llm7.io/v1/chat/completions", llmKey, llmModel);
      if (got) return json(res, 200, got);
    } catch (e) {
      last = String(e.message || e);
    }

    if (secret.key) {
      try {
        const got = await callOpenAI(
          secret.url || "https://api.superairena.com/v1/chat/completions",
          secret.key,
          body.model || secret.model || "gpt-4o"
        );
        if (got) return json(res, 200, got);
      } catch (e) {
        last = String(e.message || e);
      }
    }

    if (userKey) {
      const endpoints = {
        superairena: {
          url: "https://api.superairena.com/v1/chat/completions",
          model: body.model || "gpt-4o",
        },
        cometapi: {
          url: "https://api.cometapi.com/v1/chat/completions",
          model: body.model || "gemini-3.6-flash",
        },
        groq: {
          url: "https://api.groq.com/openai/v1/chat/completions",
          model: body.model || "llama-3.1-8b-instant",
        },
        gemini: {
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          model: body.model || "gemini-2.0-flash",
        },
        openrouter: {
          url: "https://openrouter.ai/api/v1/chat/completions",
          model: body.model || "meta-llama/llama-3.1-8b-instruct:free",
        },
      };
      const ep = endpoints[provider] || endpoints.superairena;
      const extra =
        provider === "openrouter" ? { "HTTP-Referer": "https://zivv.app", "X-Title": "ZIVV" } : {};
      try {
        const got = await callOpenAI(ep.url, userKey, ep.model, extra);
        if (got) return json(res, 200, got);
      } catch (e) {
        last = String(e.message || e);
      }
    }

    const payload = JSON.stringify({
      model: "openai",
      messages,
      stream: false,
    });
    const targets = [
      "https://text.pollinations.ai/openai",
      "https://gen.pollinations.ai/v1/chat/completions",
    ];
    for (const target of targets) {
      try {
        const r = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: AbortSignal.timeout(16000),
        });
        const raw = await r.text();
        if (!r.ok) {
          last = raw.slice(0, 240);
          continue;
        }
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch {}
        return json(res, 200, typeof data === "string" ? { text: data } : data);
      } catch (e) {
        last = String(e.message || e);
      }
    }
    try {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt = encodeURIComponent(String((lastUser && lastUser.content) || "مرحبا").slice(0, 800));
      const r = await fetch("https://text.pollinations.ai/" + prompt + "?model=openai&referrer=zivv", {
        signal: AbortSignal.timeout(16000),
      });
      const raw = await r.text();
      if (r.ok) return json(res, 200, { text: raw });
      last = raw.slice(0, 240);
    } catch (e) {
      last = String(e.message || e);
    }
    return json(res, 502, { error: last });
  }

  if (p === "/api/ai-config" && req.method === "POST") {
    const body = await readBody(req);
    const key = String(body.key || "").trim();
    if (!key) return json(res, 400, { error: "key required" });
    const next = {
      provider: String(body.provider || "cometapi"),
      key,
      model: body.model || "gemini-3.6-flash",
      url:
        String(body.provider || "") === "cometapi"
          ? "https://api.cometapi.com/v1/chat/completions"
          : body.url || "",
    };
    fs.writeFileSync(SECRET_FILE, JSON.stringify(next, null, 2));
    return json(res, 200, { ok: true, provider: next.provider, model: next.model });
  }

  return json(res, 404, { error: "not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    json(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("ZIVV database listening on 0.0.0.0:" + PORT);
});
