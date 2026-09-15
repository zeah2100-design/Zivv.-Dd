"use strict";

// ZIVV — AI proxy (env only)
// كل مفاتيح الذكاء الاصطناعي تعيش على السيرفر في process.env فقط.
// المتصفح لا يمتلك أي مفتاح — يمر عبر /api/ai-proxy بدل الاتصال المباشر.

const { getConfig } = require("./config");

const BASE = "https://api.cometapi.com";

// Whitelist — لا نسمح بأي مسار عشوائي لتفادي إساءة الاستخدام
const ALLOWED = [
  /^\/v1\/chat\/completions$/,
  /^\/v1\/audio\/speech$/,
  /^\/v1\/audio\/transcriptions$/,
  /^\/v1beta\/models\/[^/]+:generateContent$/,
  /^\/v1beta\/models\/[^/]+:streamGenerateContent$/,
];

const MISSING = {
  ok: false,
  error: "Missing GEMINI_API_KEY",
  hint:
    "أضف المفتاح في Vercel: Settings > Environment Variables > GEMINI_API_KEY، ثم أعد النشر. محلياً: انسخ .env.example إلى .env",
};

function apiKey() {
  const cfg = getConfig();
  return String(
    process.env.GEMINI_API_KEY ||
      process.env.COMET_API_KEY ||
      process.env.AI_API_KEY ||
      (cfg.ai && (cfg.ai.cometKey || cfg.ai.cometKeyLegacy)) ||
      ""
  ).trim();
}

function timeoutFor(kind) {
  if (kind === "speech") return 30000;
  if (kind === "transcribe") return 40000;
  return 45000;
}

module.exports = async function aiProxy(body) {
  body = body || {};
  const key = apiKey();
  if (!key) return { status: 503, json: MISSING };

  const path = String(body.path || "").trim();
  if (!path.startsWith("/") || !ALLOWED.some((re) => re.test(path))) {
    return { status: 400, json: { ok: false, error: "path not allowed", path } };
  }

  const kind = String(body.kind || "json");
  const headers = {
    Authorization: "Bearer " + key,
    "x-goog-api-key": key,
  };

  try {
    if (kind === "transcribe") {
      const b64 = String(body.data || "");
      if (!b64) return { status: 400, json: { ok: false, error: "empty audio" } };
      const bin = Buffer.from(b64, "base64");
      const fd = new FormData();
      fd.append("file", new Blob([bin], { type: body.mime || "audio/webm" }), body.name || "audio.webm");
      fd.append("model", body.model || "whisper-1");
      if (body.language) fd.append("language", body.language);
      const r = await fetch(BASE + path, {
        method: "POST",
        headers: { Authorization: "Bearer " + key },
        body: fd,
        signal: AbortSignal.timeout(timeoutFor(kind)),
      });
      const raw = await r.text();
      let data = raw;
      try { data = JSON.parse(raw); } catch {}
      return { status: r.ok ? 200 : 502, json: typeof data === "object" && data ? data : { text: raw } };
    }

    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const r = await fetch(BASE + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body.payload || {}),
      signal: AbortSignal.timeout(timeoutFor(kind)),
    });

    if (kind === "speech") {
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok) {
        let msg = "";
        try { msg = buf.toString("utf8").slice(0, 300); } catch {}
        return { status: 502, json: { ok: false, error: msg || "speech failed" } };
      }
      return {
        status: 200,
        json: { ok: true, mime: r.headers.get("content-type") || "audio/mpeg", data: buf.toString("base64") },
      };
    }

    const raw = await r.text();
    let data = raw;
    try { data = JSON.parse(raw); } catch {}
    if (!r.ok) {
      return {
        status: 502,
        json: { ok: false, error: (data && data.error && (data.error.message || data.error)) || raw.slice(0, 300) },
      };
    }
    return { status: 200, json: typeof data === "object" && data ? data : { text: raw } };
  } catch (e) {
    return { status: 502, json: { ok: false, error: String((e && e.message) || e) } };
  }
};
