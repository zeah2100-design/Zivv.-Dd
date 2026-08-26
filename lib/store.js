// ZIVV Real Database - Unified Store
// This replaces the old JSON-file-in-storage implementation with real DB

const { getDatabase } = require("./database");

const db = getDatabase();

function empty() {
  return db.empty();
}

async function load() {
  return db.load();
}

async function save(data) {
  // For compatibility - in real DB we don't save whole blob, but upsert individually
  // This is called only by old code; we persist what we can
  if (data.posts) {
    for (const p of data.posts.slice(0, 50)) {
      try { await db.createPost(p); } catch {}
    }
  }
  return data;
}

async function update(fn) {
  return db.update(fn);
}

async function uploadFile(path, buf, mime) {
  return db.uploadFile(path, buf, mime);
}

// Export same interface as before plus new methods
module.exports = {
  empty,
  load,
  save,
  update,
  uploadFile,
  projectUrl: require("./config").getConfig().supabase.url,
  // New real DB access
  getDb: () => db,
};
