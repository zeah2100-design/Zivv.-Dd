"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const { URL } = require("url");
const { getConfig } = require("./lib/config");
const { getDatabase } = require("./lib/database");
const { hashPassword } = require("./lib/auth");

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
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
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

  // Health
  if (p === "/api/health" && req.method === "GET") {
    try {
      const posts = await db.getPosts(1);
      const accounts = await db.getAccounts();
      return json(res, 200, { ok: true, engine: "real-database", mode: db.mode, real: true, posts: posts.length, accounts: accounts.length, timestamp: new Date().toISOString() });
    } catch (e) {
      return json(res, 200, { ok: true, engine: "real-database", mode: db.mode, real: true, warn: String(e.message) });
    }
  }

  // Search proxy (DuckDuckGo + Wikipedia + News)
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
        const clean = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
        const t = clean(title);
        if (!t) return;
        items.push({ title: t.slice(0, 140), snippet: clean(snip).slice(0, 240), url: href ? decodeURIComponent(href) : "" });
      });
    } catch {}
    try {
      const wiki = await fetch("https://ar.wikipedia.org/w/api.php?action=query&list=search&utf8=1&format=json&srlimit=3&srsearch=" + encodeURIComponent(q), { signal: AbortSignal.timeout(8000) });
      const data = await wiki.json();
      (data.query && data.query.search ? data.query.search : []).forEach((s) => {
        items.push({ title: s.title, snippet: String(s.snippet || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), url: "https://ar.wikipedia.org/wiki/" + encodeURIComponent(s.title) });
      });
    } catch {}
    try {
      const rss = await fetch("https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=ar&gl=EG&ceid=EG:ar", { headers: { "User-Agent": "Mozilla/5.0 ZIVV" }, signal: AbortSignal.timeout(10000) });
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
      const r = await fetch("https://r.jina.ai/" + target, { headers: { "User-Agent": "Mozilla/5.0 ZIVV", Accept: "text/plain" }, signal: AbortSignal.timeout(15000) });
      const text = (await r.text()).replace(/\s+/g, " ").trim().slice(0, 2800);
      return json(res, 200, { url: target, text });
    } catch (e) { return json(res, 502, { error: String(e.message || e) }); }
  }

  // Real DB routes - delegate to same logic as api/[...path].js but directly
  const apiHandler = require("./api/[...path].js");
  // Mock Vercel req/res for compatibility
  const mockReq = { ...req, query: { path: p.replace(/^\/api\//, "").split("/").filter(Boolean) }, url: req.url };
  // Need to adapt response: we already have res, but apiHandler expects Vercel style res.status().json()
  const vercelRes = {
    status(code) { this._code = code; return this; },
    json(data) { return json(res, this._code || 200, data); },
    setHeader(k, v) { res.setHeader(k, v); },
    end(d) { res.end(d); },
  };
  // For simplicity, handle core routes here directly if not handled above
  if (p.startsWith("/api/posts") || p.startsWith("/api/likes") || p.startsWith("/api/comments") || p.startsWith("/api/products") || p.startsWith("/api/messages") || p.startsWith("/api/follows") || p.startsWith("/api/profiles") || p.startsWith("/api/accounts") || p.startsWith("/api/stories") || p.startsWith("/api/friends") || p.startsWith("/api/notes") || p.startsWith("/api/gold") || p.startsWith("/api/reports") || p.startsWith("/api/ai") || p.startsWith("/api/auth") || p.startsWith("/api/upload")) {
    return apiHandler(mockReq, vercelRes);
  }

  // AI proxy
  if (p === "/api/ai" && req.method === "POST") {
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-18) : [];
    const secret = cfg.ai.cometKey;
    let last = "ai unavailable";

    async function callComet(key, model) {
      const mid = model || cfg.ai.cometModel;
      const sys = messages.find((m) => m.role === "system");
      const contents = messages.filter((m) => m && m.role !== "system" && m.content).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }));
      try {
        const payload = { contents: contents.length ? contents : [{ parts: [{ text: "مرحبا" }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 4096 } };
        if (sys && sys.content) payload.systemInstruction = { parts: [{ text: String(sys.content) }] };
        const r = await fetch("https://api.cometapi.com/v1beta/models/" + encodeURIComponent(mid) + ":generateContent", {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(28000),
        });
        const raw = await r.text();
        let data = raw;
        try { data = JSON.parse(raw); } catch {}
        if (r.ok) {
          const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
          const text = Array.isArray(parts) ? parts.map((p) => p.text || "").join("") : "";
          if (text.trim()) return { text: text.trim() };
        } else { last = (data && data.error && (data.error.message || data.error)) || raw.slice(0, 200) || "HTTP " + r.status; }
      } catch (e) { last = String(e.message || e); }
      return null;
    }

    const key = String(body.key || secret || "").trim();
    if (key) {
      try {
        const got = await callComet(key, body.model || cfg.ai.cometModel);
        if (got) return json(res, 200, got);
      } catch (e) { last = String(e.message || e); }
    }

    // Fallback Pollinations
    try {
      const payload = JSON.stringify({ model: "openai", messages, stream: false });
      const r = await fetch("https://text.pollinations.ai/openai", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: AbortSignal.timeout(16000) });
      const raw = await r.text();
      if (r.ok) {
        let data = raw;
        try { data = JSON.parse(raw); } catch {}
        return json(res, 200, typeof data === "string" ? { text: data } : data);
      } else last = raw.slice(0, 240);
    } catch (e) { last = String(e.message || e); }

    return json(res, 502, { error: last });
  }

  if (p === "/api/ai-config" && req.method === "POST") {
    const body = await readBody(req);
    return json(res, 200, { ok: true, provider: body.provider || "cometapi", model: body.model || cfg.ai.cometModel });
  }

  return json(res, 404, { error: "not found", path: p });
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
  console.log(`ZIVV Real Database listening on 0.0.0.0:${PORT} mode=${getDatabase().mode}`);
  console.log(`Supabase: ${cfg.supabase.url}`);
});
