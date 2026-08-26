const fs = require("fs");
const path = require("path");
const { getConfig } = require("./config");

let DatabaseSync = null;
try {
  const sqlite = require("node:sqlite");
  DatabaseSync = sqlite.DatabaseSync;
} catch (e) {
  try {
    DatabaseSync = require("sqlite3")?.Database ? null : null;
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
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (DatabaseSync) {
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec(`
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
      `);
      this.createTables();
    } else {
      // Fallback to JSON file if node:sqlite not available
      this.jsonPath = this.dbPath.replace(/\.db$/, ".json");
      if (!fs.existsSync(this.jsonPath)) {
        fs.writeFileSync(this.jsonPath, JSON.stringify(this.emptyDb(), null, 2));
      }
    }
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
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_user, created_at);
      CREATE INDEX IF NOT EXISTS idx_ai_messages_chat ON ai_messages(chat_id, created_at);
    `;
    this.db.exec(sql);
  }

  // Generic helpers
  query(table, where = "", params = []) {
    if (!this.db) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.accounts || [];
    }
    return this.db.prepare("SELECT * FROM accounts LIMIT 500").all();
  }

  async getAccountByEmail(email) {
    if (!this.db) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return (data.accounts || []).find(a => a.email === email) || null;
    }
    const row = this.db.prepare("SELECT * FROM accounts WHERE email = ? LIMIT 1").get(email);
    return row || null;
  }

  async createAccount(data) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.accounts = json.accounts.filter(a => a.email !== data.email);
      json.accounts.push({ ...data, created_at: Date.now() });
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.profiles || [];
    }
    return this.db.prepare("SELECT * FROM profiles LIMIT 500").all();
  }

  async upsertProfile(p) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      const idx = json.profiles.findIndex(x => x.email === p.email || x.username === p.username);
      if (idx >= 0) json.profiles[idx] = { ...json.profiles[idx], ...p };
      else json.profiles.push(p);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return (data.posts || []).slice(0, limit).sort((a,b) => (b.created_at||0)-(a.created_at||0));
    }
    return this.db.prepare(`SELECT * FROM posts ORDER BY created_at DESC LIMIT ?`).all(limit);
  }

  async createPost(post) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.posts = json.posts.filter(x => x.id !== post.id);
      json.posts.unshift({ ...post, created_at: post.created_at || Date.now() });
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      const likes = data.likes || [];
      return postId ? likes.filter(l => l.post_id === postId) : likes;
    }
    if (postId) return this.db.prepare("SELECT * FROM likes WHERE post_id = ?").all(postId);
    return this.db.prepare("SELECT * FROM likes LIMIT 2000").all();
  }

  async toggleLike(postId, userKey, on) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.likes = (json.likes || []).filter(x => !(x.post_id === postId && x.user_key === userKey));
      if (on) json.likes.push({ post_id: postId, user_key: userKey, created_at: Date.now() });
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
      return;
    }
    if (on) {
      this.db.prepare("INSERT OR REPLACE INTO likes (post_id, user_key, created_at) VALUES (?, ?, ?)").run(postId, userKey, Date.now());
    } else {
      this.db.prepare("DELETE FROM likes WHERE post_id = ? AND user_key = ?").run(postId, userKey);
    }
  }

  async getComments(postId) {
    if (!this.db) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      const comments = data.comments || [];
      return postId ? comments.filter(c => c.post_id === postId) : comments;
    }
    if (postId) return this.db.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC").all(postId);
    return this.db.prepare("SELECT * FROM comments ORDER BY created_at ASC LIMIT 2000").all();
  }

  async createComment(c) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.comments.push(c);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
      return [c];
    }
    this.db.prepare("INSERT OR REPLACE INTO comments (id, post_id, parent_id, name, user_key, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      c.id, c.post_id, c.parent_id || null, c.name || "", c.user_key || "", c.body || c.text || "", c.created_at || Date.now()
    );
    return [c];
  }

  async getFollows() {
    if (!this.db) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.follows || [];
    }
    return this.db.prepare("SELECT * FROM follows LIMIT 4000").all();
  }

  async toggleFollow(from, to, on) {
    const a = String(from).toLowerCase();
    const b = String(to).toLowerCase();
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.follows = (json.follows || []).filter(x => !(x.follower === a && x.following === b) && !(x.from_user === a && x.to_user === b));
      if (on) json.follows.push({ follower: a, following: b, from_user: a, to_user: b, created_at: Date.now() });
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      const msgs = data.messages || [];
      return threadUser ? msgs.filter(m => m.thread_user === threadUser) : msgs;
    }
    if (threadUser) return this.db.prepare("SELECT * FROM messages WHERE thread_user = ? ORDER BY created_at ASC").all(threadUser);
    return this.db.prepare("SELECT * FROM messages ORDER BY created_at ASC LIMIT 2000").all();
  }

  async createMessage(m) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.messages.push(m);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
      return [m];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO messages (id, thread_user, from_key, from_user, name, kind, body, post_id, product_id, image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      m.id, m.thread_user, m.from_key || "", m.from_user || "", m.name || "", m.kind || "text",
      m.body || m.text || "", m.post_id || null, m.product_id || null, m.image_url || m.image || "", m.created_at || Date.now()
    );
    return [m];
  }

  async getProducts() {
    if (!this.db) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.products || [];
    }
    return this.db.prepare("SELECT * FROM products ORDER BY created_at DESC LIMIT 200").all();
  }

  async createProduct(p) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.products = (json.products || []).filter(x => x.id !== p.id);
      json.products.unshift(p);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.stories || [];
    }
    return this.db.prepare("SELECT * FROM stories ORDER BY created_at DESC LIMIT 100").all();
  }

  async createStory(s) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.stories = (json.stories || []).filter(x => x.id !== s.id);
      json.stories.unshift(s);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.friend_reqs || data.friendReqs || [];
    }
    return this.db.prepare("SELECT * FROM friend_reqs ORDER BY created_at DESC LIMIT 400").all();
  }

  async createFriendReq(r) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.friend_reqs = (json.friend_reqs || []).filter(x => x.id !== r.id);
      json.friend_reqs.unshift(r);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      const notes = data.notes || [];
      return dest ? notes.filter(n => n.dest === dest) : notes;
    }
    if (dest) return this.db.prepare("SELECT * FROM notes WHERE dest = ? ORDER BY created_at DESC LIMIT 200").all(dest);
    return this.db.prepare("SELECT * FROM notes ORDER BY created_at DESC LIMIT 500").all();
  }

  async createNote(n) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.notes.unshift(n);
      json.notes = json.notes.slice(0, 200);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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

  async getGoldReqs() {
    if (!this.db) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.gold_reqs || data.goldReqs || [];
    }
    return this.db.prepare("SELECT * FROM gold_reqs ORDER BY created_at DESC LIMIT 200").all();
  }

  async createGoldReq(r) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.gold_reqs = (json.gold_reqs || []).filter(x => x.id !== r.id);
      json.gold_reqs.unshift(r);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
      return [r];
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO gold_reqs (id, username, name, status, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(r.id, r.username || r.user || "", r.name || "", r.status || "pending", r.note || "", r.created_at || Date.now());
    return [r];
  }

  async getReports() {
    if (!this.db) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return data.reports || [];
    }
    return this.db.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT 200").all();
  }

  async createReport(r) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.reports.unshift(r);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return (data.ai_chats || []).filter(c => c.user_key === userKey).sort((a,b) => (b.updated_at||0)-(a.updated_at||0));
    }
    return this.db.prepare("SELECT * FROM ai_chats WHERE user_key = ? ORDER BY updated_at DESC LIMIT 100").all(userKey);
  }

  async upsertAiChat(chat) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.ai_chats = (json.ai_chats || []).filter(c => c.id !== chat.id);
      json.ai_chats.unshift({ ...chat, updated_at: Date.now() });
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return (data.ai_messages || []).filter(m => m.chat_id === chatId).sort((a,b) => (a.created_at||0)-(b.created_at||0));
    }
    return this.db.prepare("SELECT * FROM ai_messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 500").all(chatId);
  }

  async createAiMessage(msg) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.ai_messages.push(msg);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      const data = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      return (data.ai_usage || []).filter(u => u.user_key === userKey && u.day === day);
    }
    return this.db.prepare("SELECT * FROM ai_usage WHERE user_key = ? AND day = ? LIMIT 1").all(userKey, day);
  }

  async upsertAiUsage(usage) {
    if (!this.db) {
      const json = JSON.parse(fs.readFileSync(this.jsonPath, "utf8"));
      json.ai_usage = (json.ai_usage || []).filter(u => !(u.user_key === usage.user_key && u.day === usage.day));
      json.ai_usage.push(usage);
      fs.writeFileSync(this.jsonPath, JSON.stringify(json, null, 2));
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
      messages: messages.map(m => ({ id: m.id, thread_user: m.thread_user, from_key: m.from_key, from_user: m.from_user, name: m.name, kind: m.kind, body: m.body, post_id: m.post_id, image_url: m.image_url, created_at: m.created_at })),
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
      fs.writeFileSync(this.jsonPath, JSON.stringify({
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
      }, null, 2));
    }
    return out === undefined ? db : out;
  }
}

module.exports = SQLiteClient;
