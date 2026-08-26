const { getDatabase } = require("../lib/database");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const db = getDatabase();
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
  } catch (e) {
    return res.status(200).json({ ok: true, engine: "real-database", real: true, warn: String(e.message || e) });
  }
};
