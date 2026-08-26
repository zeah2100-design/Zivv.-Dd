const { getConfig } = require("./config");

class SupabaseClient {
  constructor() {
    const cfg = getConfig();
    this.url = cfg.supabase.url;
    this.key = cfg.supabase.secret;
    this.anon = cfg.supabase.anon;
  }

  async request(path, options = {}) {
    const url = `${this.url}/rest/v1/${path}`;
    const headers = {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    };

    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async query(table, params = "") {
    return this.request(`${table}${params ? "?" + params : ""}`);
  }

  async insert(table, row, onConflict) {
    const qp = onConflict ? `?on_conflict=${onConflict}` : "";
    return this.request(`${table}${qp}`, {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: row,
    });
  }

  async upsert(table, row, conflictKey) {
    const qp = conflictKey ? `?on_conflict=${conflictKey}` : "";
    return this.request(`${table}${qp}`, {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: row,
    });
  }

  async update(table, filter, patch) {
    return this.request(`${table}?${filter}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: patch,
    });
  }

  async delete(table, filter) {
    return this.request(`${table}?${filter}`, {
      method: "DELETE",
      prefer: "return=representation",
    });
  }

  // Storage upload
  async uploadFile(storagePath, buffer, mime) {
    const clean = String(storagePath || "file").replace(/[^a-zA-Z0-9._\/-]+/g, "_");
    const url = `${this.url}/storage/v1/object/zivv-media/${clean}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": mime || "application/octet-stream",
        "x-upsert": "true",
        "cache-control": "public, max-age=31536000",
      },
      body: buffer,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`upload ${res.status} ${t.slice(0, 200)}`);
    }
    return `${this.url}/storage/v1/object/public/zivv-media/${clean}`;
  }

  // Auth helpers with bcrypt
  async createAccount(data) {
    // data: {email, username, first_name, last_name, name, age, mark, password_hash, onboarding}
    return this.upsert("accounts", data, "email");
  }

  async getAccounts(limit = 500) {
    return this.query("accounts", `select=*&limit=${limit}`);
  }

  async getAccountByEmail(email) {
    const e = encodeURIComponent(email);
    const rows = await this.query("accounts", `email=eq.${e}&limit=1`);
    return rows && rows[0] ? rows[0] : null;
  }

  async getProfiles(limit = 500) {
    return this.query("profiles", `select=*&limit=${limit}`);
  }

  async upsertProfile(profile) {
    // try username conflict, then email
    try {
      return await this.upsert("profiles", profile, "username");
    } catch {
      return await this.upsert("profiles", profile, "email");
    }
  }

  async getPosts(limit = 250, offset = 0) {
    return this.query("posts", `select=*&order=created_at.desc&limit=${limit}&offset=${offset}`);
  }

  async createPost(post) {
    return this.upsert("posts", post, "id");
  }

  async getLikes(postId) {
    if (postId) return this.query("likes", `post_id=eq.${encodeURIComponent(postId)}`);
    return this.query("likes", `select=*&limit=2000`);
  }

  async toggleLike(postId, userKey, on) {
    if (on) {
      return this.upsert("likes", { post_id: postId, user_key: userKey }, "post_id,user_key");
    } else {
      return this.delete("likes", `post_id=eq.${encodeURIComponent(postId)}&user_key=eq.${encodeURIComponent(userKey)}`);
    }
  }

  async getComments(postId) {
    if (postId) return this.query("comments", `post_id=eq.${encodeURIComponent(postId)}&order=created_at.asc&limit=500`);
    return this.query("comments", `select=*&order=created_at.asc&limit=2000`);
  }

  async createComment(comment) {
    return this.upsert("comments", comment, "id");
  }

  async getFollows() {
    return this.query("follows", `select=*&limit=4000`);
  }

  async toggleFollow(from, to, on) {
    const a = String(from).toLowerCase();
    const b = String(to).toLowerCase();
    if (on) {
      return this.upsert("follows", { follower: a, following: b }, "follower,following");
    } else {
      return this.delete("follows", `follower=eq.${encodeURIComponent(a)}&following=eq.${encodeURIComponent(b)}`);
    }
  }

  async getMessages(threadUser) {
    if (threadUser) return this.query("messages", `thread_user=eq.${encodeURIComponent(threadUser)}&order=created_at.asc&limit=1000`);
    return this.query("messages", `select=*&order=created_at.asc&limit=2000`);
  }

  async createMessage(msg) {
    return this.upsert("messages", msg, "id");
  }

  async getProducts() {
    return this.query("products", `select=*&order=created_at.desc&limit=200`);
  }

  async createProduct(prod) {
    return this.upsert("products", prod, "id");
  }

  async getStories() {
    return this.query("stories", `select=*&order=created_at.desc&limit=100`);
  }

  async createStory(story) {
    return this.upsert("stories", story, "id");
  }

  async getFriendReqs() {
    return this.query("friend_reqs", `select=*&order=created_at.desc&limit=400`);
  }

  async createFriendReq(req) {
    return this.upsert("friend_reqs", req, "id");
  }

  async getNotes(dest) {
    if (dest) return this.query("notes", `dest=eq.${encodeURIComponent(dest)}&order=created_at.desc&limit=200`);
    return this.query("notes", `select=*&order=created_at.desc&limit=500`);
  }

  async createNote(note) {
    return this.upsert("notes", note, "id");
  }

  async getGoldReqs() {
    return this.query("gold_reqs", `select=*&order=created_at.desc&limit=200`);
  }

  async createGoldReq(req) {
    return this.upsert("gold_reqs", req, "id");
  }

  async getReports() {
    return this.query("reports", `select=*&order=created_at.desc&limit=200`);
  }

  async createReport(report) {
    return this.upsert("reports", report, "id");
  }

  // AI tables
  async getAiChats(userKey) {
    const u = encodeURIComponent(userKey);
    return this.query("ai_chats", `user_key=eq.${u}&order=updated_at.desc&limit=100`);
  }

  async upsertAiChat(chat) {
    return this.upsert("ai_chats", chat, "id");
  }

  async getAiMessages(chatId) {
    return this.query("ai_messages", `chat_id=eq.${encodeURIComponent(chatId)}&order=created_at.asc&limit=500`);
  }

  async createAiMessage(msg) {
    return this.upsert("ai_messages", msg, "id");
  }

  async getAiUsage(userKey, day) {
    const u = encodeURIComponent(userKey);
    const d = encodeURIComponent(day);
    return this.query("ai_usage", `user_key=eq.${u}&day=eq.${d}&limit=1`);
  }

  async upsertAiUsage(usage) {
    return this.upsert("ai_usage", usage, "user_key,day");
  }
}

module.exports = SupabaseClient;
