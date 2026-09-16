const fs = require("fs");
const path = require("path");
const { getConfig } = require("./config");

let DatabaseSync = null;
let dbEngine = "json";
try {
  const sqlite = require("node:sqlite");
  DatabaseSync = sqlite.DatabaseSync;
  dbEngine = "node:sqlite";
} catch (e) {
  try {
    DatabaseSync = require("better-sqlite3");
    dbEngine = "better-sqlite3";
  } catch {}
}

class SQLiteClient {
  constructor(dbPath) {
    const cfg = getConfig();
    this.dbPath = dbPath || cfg.sqlite.path;
    this.db = null;
    this.init();
  }

  init() {
    const os = require("os");
    this.ephemeral = false;
    this.memOnly = false;
    this.mem = null;
    // اختر مجلداً قابلاً للكتابة: مجلد البيانات -> /tmp (سيرفرلس) -> الذاكرة
    // لا نرمي أي استثناء أبداً — السيرفرلس (Vercel) ملفاته للقراءة فقط
    let dir = null;
    try {
      dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
    } catch { dir = null; }
    if (!dir) {
      try {
        dir = path.join(os.tmpdir(), "zivv");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.dbPath = path.join(dir, "zivv.db");
        this.ephemeral = true;
      } catch {
        this.memOnly = true;
        this.ephemeral = true;
      }
    }

    this.engine = DatabaseSync ? dbEngine : "json";
    if (!this.memOnly && DatabaseSync) {
      try {
        this.db = new DatabaseSync(this.dbPath);
        try { this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;"); } catch {}
        this.createTables();
      } catch { this.db = null; }
    }
    if (!this.db && !this.memOnly) {
      try {
        this.engine = "json";
        this.jsonPath = this.dbPath.replace(/\.db$/, ".json");
        if (!fs.existsSync(this.jsonPath)) {
          fs.writeFileSync(this.jsonPath, JSON.stringify(this.emptyDb(), null, 2));
        }
      } catch {
        this.memOnly = true;
        this.ephemeral = true;
      }
    }
    if (this.memOnly) {
      this.engine = "memory";
      this.mem = this.emptyDb();
    }
  }

  // قراءة/كتابة JSON تدعم وضع الذاكرة (للسيرفرلس عند تعذر الكتابة)
  _loadJson() {
    if (this.memOnly) return this.mem;
    const raw = fs.readFileSync(this.jsonPath, "utf8");
    return JSON.parse(raw);
  }

  _saveJson(data) {
    if (this.memOnly) { this.mem = data; return; }
    fs.writeFileSync(this.jsonPath, JSON.stringify(data, null, 2));
  }

  // بذر تلقائي: حساب تجريبي + منشورات عند أول تشغيل (مرة واحدة لكل نسخة)
  async ensureSeeded() {
    if (this._seedChecked) return false;
    this._seedChecked = true;
    try {
      const accs = await this.getAccounts().catch(() => []);
      if (accs && accs.length) return false;
      const { hashPassword } = require("./auth");
      const hash = await hashPassword("demo123");
      await this.createAccount({
        email: "demo@zivv.app", username: "demo",
        first_name: "Demo", last_name: "User", name: "مستخدم تجريبي",
        age: 25, mark: "demo", password_hash: hash,
        onboarding: { city: "القاهرة", bio: "حساب تجريبي" },
      });
      await this.upsertProfile({
        email: "demo@zivv.app", username: "demo", name: "مستخدم تجريبي",
        avatar: "brand/logo-sm.png", city: "القاهرة", bio: "حساب تجريبي لـ ZIVV",
      }).catch(() => {});
      const now = Date.now();
      const posts = [
        { id: "p_demo_1", username: "demo", name: "مستخدم تجريبي", avatar: "brand/logo-sm.png", title: "أهلاً بيكم في ZIVV 🎉", body: "منصة تواصل اجتماعي عربية — انشر، دردش، واسأل زيفي أي شيء!", type: "text", tags: ["zivv", "ترحيب"], dests: ["home", "explore"], status: "ok", created_at: new Date(now).toISOString() },
        { id: "p_demo_2", username: "demo", name: "مستخدم تجريبي", avatar: "brand/logo-sm.png", title: "جرّب زيفي AI ✨", body: "ادخل على صفحة زيفي واسأل أي سؤال — المحادثات محفوظة والعدّادات حقيقية.", type: "text", tags: ["ai", "زيفي"], dests: ["home", "explore"], status: "ok", created_at: new Date(now - 3600000).toISOString() },
      ];
      for (const p of posts) { try { await this.createPost(p); } catch {} }
      return true;
    } catch { return false; }
  }

  emptyDb() {
    return {
      accounts: [],
      profiles: [],
      posts: [],
      likes: [],
      comments: [],
      comment_likes: [],
      follows: [],
      shares: [],
      messages: [],
      products: [],
      reports: [],
      stories: [],
      friend_reqs: [],
      notes: [],
      gold_reqs: [],
      ai_chats: [],
      ai_messages: [],
      ai_usage: [],
      post_views: [],
    };
  }

  createTables() {
    if (!this.db) return;
    const sql = `
      CREATE TABLE IF NOT EXISTS accounts (
        email TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        name TEXT,
        age INTEGER,
        mark TEXT,
        password TEXT,
        password_hash TEXT,
        onboarding TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        auth_id TEXT UNIQUE,
        email TEXT UNIQUE,
        username TEXT UNIQUE,
        name TEXT,
        avatar TEXT,
        cover TEXT,
        bio TEXT,
        city TEXT,
        age INTEGER,
        locked INTEGER DEFAULT 0,
        onboarding TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        profile_id TEXT,
        username TEXT,
        name TEXT,
        avatar TEXT,
        title TEXT,
        body TEXT,
        type TEXT DEFAULT 'text',
        video_kind TEXT,
        tags TEXT,
        dests TEXT,
        image_url TEXT,
        video_url TEXT,
        audio_url TEXT,
        sound_url TEXT,
        mute_original INTEGER DEFAULT 0,
        link TEXT,
        place TEXT,
        status TEXT DEFAULT 'ok',
        visibility TEXT,
        priv INTEGER DEFAULT 0,
        extra TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS likes (
        post_id TEXT NOT NULL,
        user_key TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000),
        PRIMARY KEY (post_id, user_key)
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT,
        user_key TEXT,
        body TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id TEXT NOT NULL,
        user_key TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000),
        PRIMARY KEY (comment_id, user_key)
      );
      CREATE TABLE IF NOT EXISTS follows (
        follower TEXT NOT NULL,
        following TEXT NOT NULL,
        from_user TEXT,
        to_user TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000),
        PRIMARY KEY (follower, following)
      );
      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        from_key TEXT,
        from_name TEXT,
        to_user TEXT,
        preview TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_user TEXT NOT NULL,
        from_key TEXT,
        from_user TEXT,
        name TEXT,
        kind TEXT DEFAULT 'text',
        body TEXT,
        post_id TEXT,
        product_id TEXT,
        image_url TEXT,
        reply_to TEXT,
        read INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price REAL DEFAULT 0,
        cat TEXT,
        seller TEXT,
        seller_user TEXT,
        phone TEXT,
        image_url TEXT,
        description TEXT,
        specs TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        target_user TEXT,
        type TEXT,
        dest TEXT DEFAULT 'king',
        reporter_name TEXT,
        reporter_email TEXT,
        note TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        username TEXT,
        name TEXT,
        avatar TEXT,
        kind TEXT,
        body TEXT,
        image_url TEXT,
        video_url TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS friend_reqs (
        id TEXT PRIMARY KEY,
        from_user TEXT,
        from_name TEXT,
        to_user TEXT,
        to_name TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        dest TEXT,
        type TEXT,
        title TEXT,
        body TEXT,
        from_user TEXT,
        from_name TEXT,
        avatar TEXT,
        href TEXT,
        post_id TEXT,
        unread INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS gold_reqs (
        id TEXT PRIMARY KEY,
        username TEXT,
        name TEXT,
        status TEXT,
        note TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS ai_chats (
        id TEXT PRIMARY KEY,
        user_key TEXT NOT NULL,
        title TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000),
        updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS ai_messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        image_url TEXT,
        sources TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS ai_usage (
        user_key TEXT NOT NULL,
        day TEXT NOT NULL,
        chats_count INTEGER DEFAULT 0,
        images_count INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000),
        updated_at INTEGER DEFAULT (strftime('%s','now')*1000),
        PRIMARY KEY (user_key, day)
      );
      CREATE TABLE IF NOT EXISTS post_views (
        post_id TEXT NOT NULL,
        user_key TEXT NOT NULL,
        views INTEGER DEFAULT 1,
        updated_at INTEGER DEFAULT (strftime('%s','now')*1000),
        PRIMARY KEY (post_id, user_key)
      );
      CREATE TABLE IF NOT EXISTS msg_reactions (
        id TEXT PRIMARY KEY,
        msg_id TEXT NOT NULL,
        user_key TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS priv_auth (
        user_key TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        fails INTEGER DEFAULT 0,
        locked_until INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS mod_actions (
        id TEXT PRIMARY KEY,
        admin TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        target_user TEXT,
        reason TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        admin TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        result TEXT,
        note TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_user, created_at);
      CREATE INDEX IF NOT EXISTS idx_ai_messages_chat ON ai_messages(chat_id, created_at);
    `;
    this.db.exec(sql);
    // ترحيلات للأعمدة الجديدة في القواعد الموجودة مسبقاً
    try { this.db.exec("ALTER TABLE messages ADD COLUMN reply_to TEXT"); } catch {}
    try { this.db.exec("ALTER TABLE messages ADD COLUMN read INTEGER DEFAULT 0"); } catch {}
  }

  // Generic helpers
  query(table, where = "", params = []) {
    if (!this.db) {
      const data = this._loadJson();
      let rows = data[table] || [];
      if (where && where.post_id) rows = rows.filter(r => r.post_id === where.post_id);
      if (where && where.user_key) rows = rows.filter(r => r.user_key === where.user_key);
      return rows;
    }
    // Simple query builder for common cases
    let sql = `SELECT * FROM ${table}`;
    const values = [];
    if (where) {
      if (typeof where === "string") {
        sql += ` WHERE ${where}`;
        values.push(...params);
      } else if (typeof where === "object") {
        const clauses = [];
        Object.keys(where).forEach(k => {
          clauses.push(`${k} = ?`);
          values.push(where[k]);
        });
        if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
      }
    }
    sql += ` ORDER BY created_at DESC LIMIT 2000`;
    const stmt = this.db.prepare(sql);
    return stmt.all(...values);
  }

  // Specific methods matching SupabaseClient interface
  async getAccounts() {
    if (!this.db) {
      const data = this._loadJson();
      return data.accounts || [];
    }
    return this.db.prepare("SELECT * FROM accounts LIMIT 500").all();
  }

  async getAccountByEmail(email) {
    if (!this.db) {
      const data = this._loadJson();
      return (data.accounts || []).find(a => a.email === email) || null;
    }
    const row = this.db.prepare("SELECT * FROM accounts WHERE email = ? LIMIT 1").get(email);
    return row || null;
  }

  async createAccount(data) {
    if (!this.db) {
      const json = this._loadJson();
      json.accounts = json.accounts.filter(a => a.email !== data.email);
      json.accounts.push({ ...data, created_at: Date.now() });
      this._saveJson(json);
      return [data];
    }
    const existing = this.db.prepare("SELECT email FROM accounts WHERE email = ?").get(data.email);
    if (existing) {
      this.db.prepare(`
        UPDATE accounts SET username=?, first_name=?, last_name=?, name=?, age=?, mark=?, password=?, password_hash=?, onboarding=?
        WHERE email=?
      `).run(
        data.username || data.email.split("@")[0],
        data.first_name || "",
        data.last_name || "",
        data.name || "",
        data.age || null,
        data.mark || "",
        data.password || "",
        data.password_hash || "",
        typeof data.onboarding === "string" ? data.onboarding : JSON.stringify(data.onboarding || {}),
        data.email
      );
    } else {
      this.db.prepare(`
        INSERT INTO accounts (email, username, first_name, last_name, name, age, mark, password, password_hash, onboarding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.email,
        data.username || data.email.split("@")[0],
        data.first_name || "",
        data.last_name || "",
        data.name || "",
        data.age || null,
        data.mark || "",
        data.password || "",
        data.password_hash || "",
        typeof data.onboarding === "string" ? data.onboarding : JSON.stringify(data.onboarding || {})
      );
    }
    return [data];
  }

  async getProfiles() {
    if (!this.db) {
      const data = this._loadJson();
      return data.profiles || [];
    }
    return this.db.prepare("SELECT * FROM profiles LIMIT 500").all();
  }

  async upsertProfile(p) {
    if (!this.db) {
      const json = this._loadJson();
      const idx = json.profiles.findIndex(x => x.email === p.email || x.username === p.username);
      if (idx >= 0) json.profiles[idx] = { ...json.profiles[idx], ...p };
      else json.profiles.push(p);
      this._saveJson(json);
      return [p];
    }
    const id = p.id || require("crypto").randomUUID();
    this.db.prepare(`
      INSERT INTO profiles (id, email, username, name, avatar, cover, bio, city, age, locked, onboarding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET username=excluded.username, name=excluded.name, avatar=excluded.avatar, cover=excluded.cover, bio=excluded.bio, city=excluded.city, age=excluded.age, locked=excluded.locked, onboarding=excluded.onboarding
    `).run(
      id,
      p.email,
      p.username,
      p.name || p.username,
      p.avatar || "",
      p.cover || "",
      p.bio || "",
      p.city || "",
      p.age || null,
      p.locked ? 1 : 0,
      typeof p.onboarding === "string" ? p.onboarding : JSON.stringify(p.onboarding || {})
    );
    return [p];
  }

  async getPosts(limit = 250) {
    if (!this.db) {
      const data = this._loadJson();
      return (data.posts || []).slice(0, limit).sort((a,b) => (b.created_at||0)-(a.created_at||0));
    }
    return this.db.prepare(`SELECT * FROM posts ORDER BY created_at DESC LIMIT ?`).all(limit);
  }

  async createPost(post) {
    if (!this.db) {
      const json = this._loadJson();
      json.posts = json.posts.filter(x => x.id !== post.id);
      json.posts.unshift({ ...post, created_at: post.created_at || Date.now() });
      this._saveJson(json);
      return [post];
    }
    // Convert arrays to JSON
    const row = {
      ...post,
      tags: Array.isArray(post.tags) ? JSON.stringify(post.tags) : (post.tags || "[]"),
      dests: Array.isArray(post.dests) ? JSON.stringify(post.dests) : (post.dests || "[]"),
      extra: typeof post.extra === "string" ? post.extra : JSON.stringify(post.extra || {}),
      priv: post.priv ? 1 : 0,
      mute_original: post.mute_original ? 1 : 0,
    };
    this.db.prepare(`
      INSERT INTO posts (id, username, name, avatar, title, body, type, video_kind, tags, dests, image_url, video_url, audio_url, sound_url, mute_original, link, place, status, visibility, priv, extra, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, image_url=excluded.image_url, video_url=excluded.video_url, status=excluded.status
    `).run(
      row.id, row.username || "", row.name || "", row.avatar || "", row.title || "", row.body || "", row.type || "text",
      row.video_kind || "", row.tags, row.dests, row.image_url || "", row.video_url || "", row.audio_url || "", row.sound_url || "",
      row.mute_original, row.link || "", row.place || "", row.status || "ok", row.visibility || "", row.priv, row.extra, row.created_at || Date.now()
    );
    return [post];
  }

  async getLikes(postId) {
    if (!this.db) {
      const data = this._loadJson();
      const likes = data.likes || [];
      return postId ? likes.filter(l => l.post_id === postId) : likes;
    }
    if (postId) return this.db.prepare("SELECT * FROM likes WHERE post_id = ?").all(postId);
    return this.db.prepare("SELECT * FROM likes LIMIT 2000").all();
  }

  async toggleLike(postId, userKey, on) {
    if (!this.db) {
      const json = this._loadJson();
      json.likes = (json.likes || []).filter(x => !(x.post_id === postId && x.user_key === userKey));
      if (on) json.likes.push({ post_id: postId, user_key: userKey, created_at: Date.now() });
      this._saveJson(json);
      return;
    }
    if (on) {
      this.db.prepare("INSERT OR REPLACE INTO likes (post_id, user_key, created_at) VALUES (?, ?, ?)").run(postId, userKey, Date.now());
    } else {
      this.db.prepare("DELETE FROM likes WHERE post_id = ? AND user_key = ?").run(postId, userKey);
    }
  }

  // ---- Post views (real) ----
  async recordView(postId, userKey) {
    const pid = String(postId || "");
    const uk = (String(userKey || "guest").toLowerCase() || "guest").slice(0, 120);
    if (!pid) return { post_id: pid, views: 0 };
    if (!this.db) {
      const json = this._loadJson();
      json.post_views = json.post_views || [];
      let row = json.post_views.find(x => x.post_id === pid && x.user_key === uk);
      if (row) row.views = (row.views || 0) + 1;
      else { row = { post_id: pid, user_key: uk, views: 1 }; json.post_views.push(row); }
      row.updated_at = Date.now();
      this._saveJson(json);
      const total = json.post_views.filter(x => x.post_id === pid).reduce((s, x) => s + (x.views || 0), 0);
      return { post_id: pid, views: total };
    }
    const ex = this.db.prepare("SELECT views FROM post_views WHERE post_id = ? AND user_key = ?").get(pid, uk);
    if (ex) this.db.prepare("UPDATE post_views SET views = views + 1, updated_at = ? WHERE post_id = ? AND user_key = ?").run(Date.now(), pid, uk);
    else this.db.prepare("INSERT INTO post_views (post_id, user_key, views, updated_at) VALUES (?, ?, 1, ?)").run(pid, uk, Date.now());
    const t = this.db.prepare("SELECT COALESCE(SUM(views),0) AS total FROM post_views WHERE post_id = ?").get(pid);
    return { post_id: pid, views: (t && t.total) || 0 };
  }

  async getViews(postId) {
    if (!this.db) {
      const data = this._loadJson();
      const rows = data.post_views || [];
      return postId ? rows.filter(r => r.post_id === postId) : rows;
    }
    if (postId) return this.db.prepare("SELECT * FROM post_views WHERE post_id = ?").all(postId);
    return this.db.prepare("SELECT * FROM post_views LIMIT 5000").all();
  }

  async getPostById(id) {
    if (!this.db) {
      const data = this._loadJson();
      return (data.posts || []).find(p => String(p.id) === String(id)) || null;
    }
    return this.db.prepare("SELECT * FROM posts WHERE id = ?").get(id) || null;
  }

  async deletePost(id) {
    if (!this.db) {
      const json = this._loadJson();
      json.posts = (json.posts || []).filter(x => String(x.id) !== String(id));
      json.likes = (json.likes || []).filter(x => String(x.post_id) !== String(id));
      json.comments = (json.comments || []).filter(x => String(x.post_id) !== String(id));
      json.post_views = (json.post_views || []).filter(x => String(x.post_id) !== String(id));
      this._saveJson(json);
      return true;
    }
    this.db.prepare("DELETE FROM post_views WHERE post_id = ?").run(id);
    this.db.prepare("DELETE FROM likes WHERE post_id = ?").run(id);
    this.db.prepare("DELETE FROM comments WHERE post_id = ?").run(id);
    this.db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    return true;
  }

  async getStats() {
    const tables = ["accounts", "profiles", "posts", "likes", "comments", "follows", "messages", "products", "stories", "friend_reqs", "notes", "gold_reqs", "reports", "ai_chats", "ai_messages", "msg_reactions", "mod_actions", "audit_log"];
    const today = new Date().toISOString().slice(0, 10);
    if (!this.db) {
      const data = this._loadJson();
      const out = { views: (data.post_views || []).reduce((s, x) => s + (x.views || 0), 0) };
      tables.forEach(t => { out[t] = (data[t] || []).length; });
      const usage = (data.ai_usage || []).filter(u => u.day === today);
      out.ai_usage_today = {
        chats: usage.reduce((s, u) => s + (u.chats_count || 0), 0),
        tokens: usage.reduce((s, u) => s + (u.tokens_used || 0), 0),
        images: usage.reduce((s, u) => s + (u.images_count || 0), 0),
      };
      return out;
    }
    const out = {};
    tables.forEach(t => {
      try { const r = this.db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get(); out[t] = (r && r.c) || 0; }
      catch { out[t] = 0; }
    });
    try { const r = this.db.prepare("SELECT COALESCE(SUM(views),0) AS t FROM post_views").get(); out.views = (r && r.t) || 0; } catch { out.views = 0; }
    try {
      const u = this.db.prepare("SELECT COALESCE(SUM(chats_count),0) c, COALESCE(SUM(tokens_used),0) t, COALESCE(SUM(images_count),0) i FROM ai_usage WHERE day = ?").get(today);
      out.ai_usage_today = { chats: (u && u.c) || 0, tokens: (u && u.t) || 0, images: (u && u.i) || 0 };
    } catch { out.ai_usage_today = { chats: 0, tokens: 0, images: 0 }; }
    return out;
  }

  async getComments(postId) {
    if (!this.db) {
      const data = this._loadJson();
      const comments = data.comments || [];
      return postId ? comments.filter(c => c.post_id === postId) : comments;
    }
    if (postId) return this.db.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC").all(postId);
    return this.db.prepare("SELECT * FROM comments ORDER BY created_at ASC LIMIT 2000").all();
  }

  async createComment(c) {
    if (!this.db) {
      const json = this._loadJson();
      json.comments.push(c);
      this._saveJson(json);
      return [c];
    }
    this.db.prepare("INSERT OR REPLACE INTO comments (id, post_id, parent_id, name, user_key, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      c.id, c.post_id, c.parent_id || null, c.name || "", c.user_key || "", c.body || c.text || "", c.created_at || Date.now()
    );
    return [c];
  }

  async getFollows() {
    if (!this.db) {
      const data = this._loadJson();
      return data.follows || [];
    }
    return this.db.prepare("SELECT * FROM follows LIMIT 4000").all();
  }

  async toggleFollow(from, to, on) {
    const a = String(from).toLowerCase();
    const b = String(to).toLowerCase();
    if (!this.db) {
      const json = this._loadJson();
      json.follows = (json.follows || []).filter(x => !(x.follower === a && x.following === b) && !(x.from_user === a && x.to_user === b));
      if (on) json.follows.push({ follower: a, following: b, from_user: a, to_user: b, created_at: Date.now() });
      this._saveJson(json);
      return;
    }
    if (on) {
      this.db.prepare("INSERT OR REPLACE INTO follows (follower, following, from_user, to_user, created_at) VALUES (?, ?, ?, ?, ?)").run(a, b, a, b, Date.now());
    } else {
      this.db.prepare("DELETE FROM follows WHERE follower = ? AND following = ?").run(a, b);
    }
  }

  async getMessages(threadUser) {
    if (!this.db) {
      const data = this._loadJson();
      const msgs = data.messages || [];
      return threadUser ? msgs.filter(m => m.thread_user === threadUser) : msgs;
    }
    if (threadUser) return this.db.prepare("SELECT * FROM messages WHERE thread_user = ? ORDER BY created_at ASC").all(threadUser);
    return this.db.prepare("SELECT * FROM messages ORDER BY created_at ASC LIMIT 2000").all();
  }

  async createMessage(m) {
    if (!this.db) {
      const json = this._loadJson();
      json.messages.push(m);
      this._saveJson(json);
      return [m];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO messages (id, thread_user, from_key, from_user, name, kind, body, post_id, product_id, image_url, reply_to, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      m.id, m.thread_user, m.from_key || "", m.from_user || "", m.name || "", m.kind || "text",
      m.body || m.text || "", m.post_id || null, m.product_id || null, m.image_url || m.image || "", m.reply_to || null, m.read ? 1 : 0, m.created_at || Date.now()
    );
    return [m];
  }

  async getProducts() {
    if (!this.db) {
      const data = this._loadJson();
      return data.products || [];
    }
    return this.db.prepare("SELECT * FROM products ORDER BY created_at DESC LIMIT 200").all();
  }

  async createProduct(p) {
    if (!this.db) {
      const json = this._loadJson();
      json.products = (json.products || []).filter(x => x.id !== p.id);
      json.products.unshift(p);
      this._saveJson(json);
      return [p];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO products (id, title, price, cat, seller, seller_user, phone, image_url, description, specs, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      p.id, p.title, p.price || 0, p.cat || "", p.seller || "", p.seller_user || p.sellerUser || "", p.phone || "",
      p.image_url || p.image || "", p.description || p.desc || "", Array.isArray(p.specs) ? JSON.stringify(p.specs) : (p.specs || "[]"),
      p.created_at || Date.now()
    );
    return [p];
  }

  async getStories() {
    if (!this.db) {
      const data = this._loadJson();
      return data.stories || [];
    }
    return this.db.prepare("SELECT * FROM stories ORDER BY created_at DESC LIMIT 100").all();
  }

  async createStory(s) {
    if (!this.db) {
      const json = this._loadJson();
      json.stories = (json.stories || []).filter(x => x.id !== s.id);
      json.stories.unshift(s);
      this._saveJson(json);
      return [s];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO stories (id, username, name, avatar, kind, body, image_url, video_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s.id, s.username || s.user || "", s.name || "", s.avatar || "", s.kind || "text", s.body || s.text || "", s.image_url || s.image || "", s.video_url || s.videoId || "", s.created_at || Date.now());
    return [s];
  }

  async getFriendReqs() {
    if (!this.db) {
      const data = this._loadJson();
      return data.friend_reqs || data.friendReqs || [];
    }
    return this.db.prepare("SELECT * FROM friend_reqs ORDER BY created_at DESC LIMIT 400").all();
  }

  async createFriendReq(r) {
    if (!this.db) {
      const json = this._loadJson();
      json.friend_reqs = (json.friend_reqs || []).filter(x => x.id !== r.id);
      json.friend_reqs.unshift(r);
      this._saveJson(json);
      return [r];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO friend_reqs (id, from_user, from_name, to_user, to_name, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(r.id, r.from_user || r.from || "", r.from_name || r.fromName || "", r.to_user || r.to || "", r.to_name || r.toName || "", r.status || "pending", r.created_at || Date.now());
    return [r];
  }

  async getNotes(dest) {
    if (!this.db) {
      const data = this._loadJson();
      const notes = data.notes || [];
      return dest ? notes.filter(n => n.dest === dest) : notes;
    }
    if (dest) return this.db.prepare("SELECT * FROM notes WHERE dest = ? ORDER BY created_at DESC LIMIT 200").all(dest);
    return this.db.prepare("SELECT * FROM notes ORDER BY created_at DESC LIMIT 500").all();
  }

  async createNote(n) {
    if (!this.db) {
      const json = this._loadJson();
      json.notes.unshift(n);
      json.notes = json.notes.slice(0, 200);
      this._saveJson(json);
      return [n];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO notes (id, dest, type, title, body, from_user, from_name, avatar, href, post_id, unread, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      n.id, n.dest || n.to || "", n.type || "official", n.title || "", n.body || n.text || "",
      n.from_user || n.from || "", n.from_name || n.fromName || "", n.avatar || "", n.href || "", n.post_id || n.postId || null,
      n.unread !== false ? 1 : 0, n.created_at || Date.now()
    );
    return [n];
  }

  async markNotesRead(dest) {
    const d = String(dest || "").toLowerCase();
    if (!d) return false;
    if (!this.db) {
      const json = this._loadJson();
      (json.notes || []).forEach(n => { if (String(n.dest || "").toLowerCase() === d) n.unread = 0; });
      this._saveJson(json);
      return true;
    }
    this.db.prepare("UPDATE notes SET unread = 0 WHERE dest = ?").run(d);
    return true;
  }

  async getGoldReqs() {
    if (!this.db) {
      const data = this._loadJson();
      return data.gold_reqs || data.goldReqs || [];
    }
    return this.db.prepare("SELECT * FROM gold_reqs ORDER BY created_at DESC LIMIT 200").all();
  }

  async createGoldReq(r) {
    if (!this.db) {
      const json = this._loadJson();
      json.gold_reqs = (json.gold_reqs || []).filter(x => x.id !== r.id);
      json.gold_reqs.unshift(r);
      this._saveJson(json);
      return [r];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO gold_reqs (id, username, name, status, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(r.id, r.username || r.user || "", r.name || "", r.status || "pending", r.note || "", r.created_at || Date.now());
    return [r];
  }

  async updateGoldReq(id, status) {
    if (!this.db) {
      const j = this._loadJson();
      const r = (j.gold_reqs || []).find(x => String(x.id) === String(id));
      if (r) { r.status = status; this._saveJson(j); }
      return true;
    }
    this.db.prepare("UPDATE gold_reqs SET status = ? WHERE id = ?").run(status, id);
    return true;
  }

  async updateAccountPassword(email, hash) {
    const em = String(email || "").toLowerCase();
    if (!this.db) {
      const j = this._loadJson();
      const a = (j.accounts || []).find(x => String(x.email || "").toLowerCase() === em);
      if (!a) return false;
      a.password_hash = hash; delete a.password;
      this._saveJson(j); return true;
    }
    const r = this.db.prepare("UPDATE accounts SET password_hash = ? WHERE LOWER(email) = ?").run(hash, em);
    return r.changes > 0;
  }

  async getReactions(msgId) {
    if (!this.db) {
      const rows = this._loadJson().msg_reactions || [];
      return msgId ? rows.filter(r => String(r.msg_id) === String(msgId)) : rows;
    }
    if (msgId) return this.db.prepare("SELECT * FROM msg_reactions WHERE msg_id = ? ORDER BY created_at ASC").all(msgId);
    return this.db.prepare("SELECT * FROM msg_reactions ORDER BY created_at DESC LIMIT 2000").all();
  }

  async toggleReaction(msgId, userKey, emoji) {
    const uk = String(userKey || "").toLowerCase();
    const id = msgId + ":" + uk + ":" + emoji;
    if (!this.db) {
      const j = this._loadJson();
      j.msg_reactions = j.msg_reactions || [];
      const i = j.msg_reactions.findIndex(r => String(r.id) === id);
      if (i >= 0) { j.msg_reactions.splice(i, 1); this._saveJson(j); return { on: false }; }
      const row = { id, msg_id: msgId, user_key: uk, emoji, created_at: Date.now() };
      j.msg_reactions.push(row); this._saveJson(j); return { on: true, row };
    }
    const ex = this.db.prepare("SELECT id FROM msg_reactions WHERE id = ?").get(id);
    if (ex) { this.db.prepare("DELETE FROM msg_reactions WHERE id = ?").run(id); return { on: false }; }
    this.db.prepare("INSERT INTO msg_reactions (id, msg_id, user_key, emoji, created_at) VALUES (?, ?, ?, ?, ?)").run(id, msgId, uk, emoji, Date.now());
    return { on: true };
  }

  async getMessageById(id) {
    if (!this.db) {
      return (this._loadJson().messages || []).find(m => String(m.id) === String(id)) || null;
    }
    return this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id) || null;
  }

  async deleteMessage(id) {
    if (!this.db) {
      const j = this._loadJson();
      j.messages = (j.messages || []).filter(m => String(m.id) !== String(id));
      j.msg_reactions = (j.msg_reactions || []).filter(r => String(r.msg_id) !== String(id));
      this._saveJson(j); return true;
    }
    this.db.prepare("DELETE FROM msg_reactions WHERE msg_id = ?").run(id);
    this.db.prepare("DELETE FROM messages WHERE id = ?").run(id);
    return true;
  }

  async markMessagesRead(threadUser, peer) {
    const th = String(threadUser || "").toLowerCase(), fr = String(peer || "").toLowerCase();
    if (!this.db) {
      const j = this._loadJson();
      (j.messages || []).forEach(m => {
        if (String(m.thread_user || "").toLowerCase() === th && String(m.from_user || m.from_key || "").toLowerCase() === fr) m.read = 1;
      });
      this._saveJson(j); return true;
    }
    this.db.prepare("UPDATE messages SET read = 1 WHERE LOWER(thread_user) = ? AND (LOWER(from_user) = ? OR LOWER(from_key) = ?)").run(th, fr, fr);
    return true;
  }

  async updateFriendReq(id, status) {
    if (!this.db) {
      const j = this._loadJson();
      const r = (j.friend_reqs || []).find(x => String(x.id) === String(id));
      if (r) { r.status = status; this._saveJson(j); }
      return true;
    }
    this.db.prepare("UPDATE friend_reqs SET status = ? WHERE id = ?").run(status, id);
    return true;
  }

  async getPrivAuth(user) {
    const u = String(user || "").toLowerCase();
    if (!this.db) {
      return (this._loadJson().priv_auth || []).find(x => String(x.user_key) === u) || null;
    }
    return this.db.prepare("SELECT * FROM priv_auth WHERE user_key = ?").get(u) || null;
  }

  async setPrivAuth(user, patch) {
    const u = String(user || "").toLowerCase();
    patch = patch || {};
    if (!this.db) {
      const j = this._loadJson();
      j.priv_auth = j.priv_auth || [];
      let r = j.priv_auth.find(x => String(x.user_key) === u);
      if (!r) { r = { user_key: u, created_at: Date.now() }; j.priv_auth.push(r); }
      Object.assign(r, patch);
      this._saveJson(j); return true;
    }
    const ex = this.db.prepare("SELECT user_key FROM priv_auth WHERE user_key = ?").get(u);
    if (!ex) this.db.prepare("INSERT INTO priv_auth (user_key, hash, fails, locked_until, created_at) VALUES (?, ?, 0, 0, ?)").run(u, patch.hash || "", Date.now());
    const sets = [], vals = [];
    if (patch.hash !== undefined) { sets.push("hash = ?"); vals.push(patch.hash); }
    if (patch.fails !== undefined) { sets.push("fails = ?"); vals.push(patch.fails); }
    if (patch.locked_until !== undefined) { sets.push("locked_until = ?"); vals.push(patch.locked_until); }
    if (sets.length) this.db.prepare("UPDATE priv_auth SET " + sets.join(", ") + " WHERE user_key = ?").run(...vals, u);
    return true;
  }

  async getModActions() {
    if (!this.db) return this._loadJson().mod_actions || [];
    try { return this.db.prepare("SELECT * FROM mod_actions ORDER BY created_at DESC LIMIT 500").all(); }
    catch { return []; }
  }

  async createModAction(a) {
    if (!this.db) {
      const j = this._loadJson();
      j.mod_actions = j.mod_actions || [];
      j.mod_actions.unshift(a); this._saveJson(j); return [a];
    }
    this.db.prepare("INSERT OR REPLACE INTO mod_actions (id, admin, action, target_type, target_id, target_user, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(a.id, a.admin, a.action, a.target_type || "", a.target_id || "", a.target_user || "", a.reason || "", a.created_at || Date.now());
    return [a];
  }

  async getAuditLog() {
    if (!this.db) return this._loadJson().audit_log || [];
    try { return this.db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500").all(); }
    catch { return []; }
  }

  async createAuditLog(a) {
    if (!this.db) {
      const j = this._loadJson();
      j.audit_log = j.audit_log || [];
      j.audit_log.unshift(a); this._saveJson(j); return [a];
    }
    this.db.prepare("INSERT OR REPLACE INTO audit_log (id, admin, action, target, result, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(a.id, a.admin, a.action, a.target || "", a.result || "", a.note || "", a.created_at || Date.now());
    return [a];
  }

  async getReports() {
    if (!this.db) {
      const data = this._loadJson();
      return data.reports || [];
    }
    return this.db.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT 200").all();
  }

  async createReport(r) {
    if (!this.db) {
      const json = this._loadJson();
      json.reports.unshift(r);
      this._saveJson(json);
      return [r];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO reports (id, post_id, target_user, type, dest, reporter_name, reporter_email, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      r.id, r.post_id || r.postId || null, r.target_user || r.targetUser || "", r.type || "post", r.dest || "king",
      r.reporter_name || r.reporterName || "", r.reporter_email || r.reporterEmail || "", r.note || "", r.created_at || Date.now()
    );
    return [r];
  }

  // AI
  async getAiChats(userKey) {
    if (!this.db) {
      const data = this._loadJson();
      return (data.ai_chats || []).filter(c => c.user_key === userKey).sort((a,b) => (b.updated_at||0)-(a.updated_at||0));
    }
    return this.db.prepare("SELECT * FROM ai_chats WHERE user_key = ? ORDER BY updated_at DESC LIMIT 100").all(userKey);
  }

  async upsertAiChat(chat) {
    if (!this.db) {
      const json = this._loadJson();
      json.ai_chats = (json.ai_chats || []).filter(c => c.id !== chat.id);
      json.ai_chats.unshift({ ...chat, updated_at: Date.now() });
      this._saveJson(json);
      return [chat];
    }
    this.db.prepare(`
      INSERT INTO ai_chats (id, user_key, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at
    `).run(chat.id, chat.user_key, chat.title || "دردشة جديدة", chat.created_at || Date.now(), chat.updated_at || Date.now());
    return [chat];
  }

  async getAiMessages(chatId) {
    if (!this.db) {
      const data = this._loadJson();
      return (data.ai_messages || []).filter(m => m.chat_id === chatId).sort((a,b) => (a.created_at||0)-(b.created_at||0));
    }
    return this.db.prepare("SELECT * FROM ai_messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 500").all(chatId);
  }

  async createAiMessage(msg) {
    if (!this.db) {
      const json = this._loadJson();
      json.ai_messages.push(msg);
      this._saveJson(json);
      return [msg];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO ai_messages (id, chat_id, role, content, image_url, sources, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id, msg.chat_id, msg.role, msg.content || "", msg.image_url || msg.image || "",
      typeof msg.sources === "string" ? msg.sources : JSON.stringify(msg.sources || []),
      msg.created_at || Date.now()
    );
    return [msg];
  }

  async getAiUsage(userKey, day) {
    if (!this.db) {
      const data = this._loadJson();
      return (data.ai_usage || []).filter(u => u.user_key === userKey && u.day === day);
    }
    return this.db.prepare("SELECT * FROM ai_usage WHERE user_key = ? AND day = ? LIMIT 1").all(userKey, day);
  }

  async upsertAiUsage(usage) {
    if (!this.db) {
      const json = this._loadJson();
      json.ai_usage = (json.ai_usage || []).filter(u => !(u.user_key === usage.user_key && u.day === usage.day));
      json.ai_usage.push(usage);
      this._saveJson(json);
      return [usage];
    }
    this.db.prepare(`
      INSERT INTO ai_usage (user_key, day, chats_count, images_count, tokens_used, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_key, day) DO UPDATE SET chats_count=excluded.chats_count, images_count=excluded.images_count, tokens_used=excluded.tokens_used, updated_at=excluded.updated_at
    `).run(
      usage.user_key, usage.day, usage.chats_count || 0, usage.images_count || 0, usage.tokens_used || 0,
      usage.created_at || Date.now(), usage.updated_at || Date.now()
    );
    return [usage];
  }

  async uploadFile(path, buffer, mime) {
    // For SQLite mode, save to local filesystem and return relative URL
    const fs = require("fs");
    const pathMod = require("path");
    const clean = String(path).replace(/[^a-zA-Z0-9._\/-]+/g, "_");
    const fullPath = pathMod.join(__dirname, "..", "uploads", clean);
    const dir = pathMod.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return `/uploads/${clean}`;
  }

  // For compatibility with old store.js
  async load() {
    const posts = await this.getPosts(1000);
    const likes = await this.getLikes();
    const comments = await this.getComments();
    const profiles = await this.getProfiles();
    const accounts = await this.getAccounts();
    const follows = await this.getFollows();
    const messages = await this.getMessages();
    const products = await this.getProducts();
    const stories = await this.getStories();
    const friendReqs = await this.getFriendReqs();
    const notes = await this.getNotes();
    const goldReqs = await this.getGoldReqs();
    const reports = await this.getReports();

    // Normalize to old format
    return {
      posts: posts.map(p => ({
        ...p,
        tags: typeof p.tags === "string" ? JSON.parse(p.tags || "[]") : (p.tags || []),
        dests: typeof p.dests === "string" ? JSON.parse(p.dests || "[]") : (p.dests || []),
        extra: typeof p.extra === "string" ? JSON.parse(p.extra || "{}") : (p.extra || {}),
      })),
      likes: likes.map(l => ({ post_id: l.post_id, user_key: l.user_key, created_at: l.created_at })),
      comments: comments.map(c => ({ id: c.id, post_id: c.post_id, parent_id: c.parent_id, name: c.name, user_key: c.user_key, body: c.body, created_at: c.created_at })),
      profiles,
      accounts,
      follows: follows.map(f => ({ follower: f.follower, following: f.following, from_user: f.from_user || f.follower, to_user: f.to_user || f.following, created_at: f.created_at })),
      messages: messages.map(m => ({ id: m.id, thread_user: m.thread_user, from_key: m.from_key, from_user: m.from_user, name: m.name, kind: m.kind, body: m.body, post_id: m.post_id, image_url: m.image_url, reply_to: m.reply_to || null, read: m.read ? 1 : 0, created_at: m.created_at })),
      products,
      stories,
      friendReqs,
      notes,
      goldReqs,
      reports,
    };
  }

  async update(fn) {
    const db = await this.load();
    const out = await fn(db);
    // For SQLite, we need to persist changes - simplified: save all
    if (this.db) {
      // This is complex, so we just execute the function and let individual methods handle persistence
      // For compatibility, we re-save posts if changed
      if (db.posts) {
        for (const p of db.posts) {
          await this.createPost(p);
        }
      }
    } else {
      this._saveJson({
        accounts: db.accounts || [],
        profiles: db.profiles || [],
        posts: db.posts || [],
        likes: db.likes || [],
        comments: db.comments || [],
        follows: db.follows || [],
        messages: db.messages || [],
        products: db.products || [],
        reports: db.reports || [],
        stories: db.stories || [],
        friend_reqs: db.friendReqs || [],
        notes: db.notes || [],
        gold_reqs: db.goldReqs || [],
        ai_chats: [],
        ai_messages: [],
        ai_usage: [],
      });
    }
    return out === undefined ? db : out;
  }
}

module.exports = SQLiteClient;
