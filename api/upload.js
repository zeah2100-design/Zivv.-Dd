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

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
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
    if (buf.length > 10000000) return res.status(413).json({ error: "file too big (max 10MB)" });
    const ext =
      /png/i.test(mime) ? "png" :
      /webp/i.test(mime) ? "webp" :
      /gif/i.test(mime) ? "gif" :
      /webm/i.test(mime) ? "webm" :
      /mp4|quicktime/i.test(mime) ? "mp4" :
      /mpeg|mp3/i.test(mime) ? "mp3" :
      /wav/i.test(mime) ? "wav" :
      /jpeg|jpg/i.test(mime) ? "jpg" : "bin";
    const base = String(body.name || "f" + Date.now()).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const path = "files/" + base + "-" + Date.now().toString(36) + "." + ext;

    const db = getDatabase();
    const url = await db.uploadFile(path, buf, mime);
    return res.status(200).json({ ok: true, url, mode: db.mode });
  } catch (e) {
    console.error("[UPLOAD ERROR]", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
};
