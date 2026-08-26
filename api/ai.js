const { getConfig } = require("../lib/config");
const { getDatabase } = require("../lib/database");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Cache-Control", "no-store");
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

async function callComet(key, model, messages) {
  const sys = messages.find(m => m.role === "system");
  const contents = messages.filter(m => m && m.role !== "system" && m.content).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content) }],
  }));

  const payload = {
    contents: contents.length ? contents : [{ parts: [{ text: "مرحبا" }] }],
    tools: [{ google_search: {} }],
    generationConfig: { maxOutputTokens: 4096 },
  };
  if (sys && sys.content) payload.systemInstruction = { parts: [{ text: String(sys.content) }] };

  const r = await fetch(`https://api.cometapi.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(28000),
  });
  const raw = await r.text();
  let data = raw;
  try { data = JSON.parse(raw); } catch {}
  if (r.ok) {
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map(p => p.text || "").join("") : "";
    if (text.trim()) return { text: text.trim(), raw: data };
  }
  throw new Error((data?.error?.message) || raw.slice(0, 200) || `HTTP ${r.status}`);
}

async function callOpenAI(url, key, model, messages, extraHeaders) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key, ...extraHeaders },
    body: JSON.stringify({ model, messages, stream: false, max_tokens: 4096 }),
    signal: AbortSignal.timeout(28000),
  });
  const raw = await r.text();
  let data = raw;
  try { data = JSON.parse(raw); } catch {}
  if (!r.ok) throw new Error((data?.error?.message) || raw.slice(0, 200) || `HTTP ${r.status}`);
  return data;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const cfg = getConfig();
    const db = getDatabase();

    // Log usage if user provided
    const userKey = String(body.user_key || body.key || "anonymous").toLowerCase();
    const day = new Date().toISOString().slice(0, 10);

    // Try Comet first
    const cometKey = String(body.key || cfg.ai.cometKey || "").trim();
    if (cometKey) {
      try {
        const got = await callComet(cometKey, body.model || cfg.ai.cometModel || "gemini-3.6-flash", messages);
        // Log to DB
        try {
          const usage = await db.getAiUsage(userKey, day).then(r => r[0] || { user_key: userKey, day, chats_count: 0, images_count: 0, tokens_used: 0 }).catch(() => ({ user_key: userKey, day, chats_count: 0 }));
          await db.upsertAiUsage({
            user_key: userKey,
            day,
            chats_count: (usage.chats_count || 0) + 1,
            images_count: usage.images_count || 0,
            tokens_used: (usage.tokens_used || 0) + Math.ceil((got.text || "").length / 4),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch {}
        return res.status(200).json({ choices: [{ message: { content: got.text } }], text: got.text, model: body.model || cfg.ai.cometModel });
      } catch (e) {
        console.warn("[AI Comet failed]", e.message);
      }
    }

    // Fallback to Pollinations
    try {
      const payload = JSON.stringify({ model: "openai", messages, stream: false });
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(15000),
      });
      const raw = await r.text();
      if (r.ok) {
        let data = raw;
        try { data = JSON.parse(raw); } catch {}
        return res.status(200).json(typeof data === "string" ? { text: data } : data);
      }
    } catch (e) {
      console.warn("[AI Pollinations failed]", e.message);
    }

    return res.status(502).json({ error: "AI unavailable, try again" });
  } catch (e) {
    console.error("[AI ERROR]", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
};
