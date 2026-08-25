const store = require("../lib/store");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const db = await store.load();
    return res.status(200).json({
      ok: true,
      engine: "supabase-storage",
      real: true,
      posts: (db.posts || []).length,
      accounts: (db.accounts || []).length
    });
  } catch (e) {
    return res.status(200).json({ ok: true, engine: "supabase-storage", real: true, warn: String(e.message || e) });
  }
};
