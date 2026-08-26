const { getConfig } = require("./config");
const SupabaseClient = require("./supabase");
const SQLiteClient = require("./sqlite");

let instance = null;

function getDb() {
  if (instance) return instance;

  const cfg = getConfig();

  if (cfg.hasSupabase) {
    console.log(`[DB] Using Supabase real database: ${cfg.supabase.url}`);
    instance = new SupabaseClient();
    instance.mode = "supabase";
  } else {
    console.log(`[DB] Using SQLite local database: ${cfg.sqlite.path}`);
    instance = new SQLiteClient(cfg.sqlite.path);
    instance.mode = "sqlite";
  }

  return instance;
}

// Unified interface that works with both
class Database {
  constructor() {
    this.client = getDb();
    this.mode = this.client.mode;
  }

  // Accounts
  async getAccounts() { return this.client.getAccounts(); }
  async getAccountByEmail(email) { return this.client.getAccountByEmail(email); }
  async createAccount(data) { return this.client.createAccount(data); }

  // Profiles
  async getProfiles() { return this.client.getProfiles(); }
  async upsertProfile(p) { return this.client.upsertProfile(p); }

  // Posts
  async getPosts(limit) { return this.client.getPosts(limit); }
  async createPost(post) { return this.client.createPost(post); }

  // Likes
  async getLikes(postId) { return this.client.getLikes(postId); }
  async toggleLike(postId, userKey, on) { return this.client.toggleLike(postId, userKey, on); }

  // Comments
  async getComments(postId) { return this.client.getComments(postId); }
  async createComment(c) { return this.client.createComment(c); }

  // Follows
  async getFollows() { return this.client.getFollows(); }
  async toggleFollow(from, to, on) { return this.client.toggleFollow(from, to, on); }

  // Messages
  async getMessages(thread) { return this.client.getMessages(thread); }
  async createMessage(m) { return this.client.createMessage(m); }

  // Products
  async getProducts() { return this.client.getProducts(); }
  async createProduct(p) { return this.client.createProduct(p); }

  // Stories
  async getStories() { return this.client.getStories(); }
  async createStory(s) { return this.client.createStory(s); }

  // Friends
  async getFriendReqs() { return this.client.getFriendReqs(); }
  async createFriendReq(r) { return this.client.createFriendReq(r); }

  // Notes
  async getNotes(dest) { return this.client.getNotes(dest); }
  async createNote(n) { return this.client.createNote(n); }

  // Gold
  async getGoldReqs() { return this.client.getGoldReqs(); }
  async createGoldReq(r) { return this.client.createGoldReq(r); }

  // Reports
  async getReports() { return this.client.getReports(); }
  async createReport(r) { return this.client.createReport(r); }

  // AI
  async getAiChats(userKey) { return this.client.getAiChats(userKey); }
  async upsertAiChat(chat) { return this.client.upsertAiChat(chat); }
  async getAiMessages(chatId) { return this.client.getAiMessages(chatId); }
  async createAiMessage(msg) { return this.client.createAiMessage(msg); }
  async getAiUsage(userKey, day) { return this.client.getAiUsage(userKey, day); }
  async upsertAiUsage(usage) { return this.client.upsertAiUsage(usage); }

  // Media
  async uploadFile(path, buffer, mime) { return this.client.uploadFile(path, buffer, mime); }

  // Compatibility
  async load() {
    if (this.client.load) return this.client.load();
    // Build from individual gets
    const [posts, likes, comments, profiles, accounts, follows, messages, products, stories, friendReqs, notes, goldReqs, reports] = await Promise.all([
      this.getPosts(1000).catch(() => []),
      this.getLikes().catch(() => []),
      this.getComments().catch(() => []),
      this.getProfiles().catch(() => []),
      this.getAccounts().catch(() => []),
      this.getFollows().catch(() => []),
      this.getMessages().catch(() => []),
      this.getProducts().catch(() => []),
      this.getStories().catch(() => []),
      this.getFriendReqs().catch(() => []),
      this.getNotes().catch(() => []),
      this.getGoldReqs().catch(() => []),
      this.getReports().catch(() => []),
    ]);
    return { posts, likes, comments, profiles, accounts, follows, messages, products, stories, friendReqs, notes, goldReqs, reports };
  }

  async update(fn) {
    if (this.client.update) return this.client.update(fn);
    const db = await this.load();
    const out = await fn(db);
    return out || db;
  }

  empty() {
    return {
      accounts: [],
      profiles: [],
      posts: [],
      likes: [],
      comments: [],
      commentLikes: [],
      follows: [],
      shares: [],
      messages: [],
      products: [],
      reports: [],
      stories: [],
      friendReqs: [],
      notes: [],
      goldReqs: [],
      ai_chats: [],
      ai_messages: [],
      ai_usage: [],
    };
  }
}

function getDatabase() {
  return new Database();
}

module.exports = { getDb, getDatabase, Database };
