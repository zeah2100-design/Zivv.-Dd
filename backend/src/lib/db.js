// Postgres data layer (Neon serverless HTTP driver).
// Same response shapes as the old in-memory store — the frontend needs no changes.
const { neon } = require('@neondatabase/serverless');
const { v4: uuid } = require('uuid');

let _sql = null;
function sql() {
  if (!_sql) {
    const url = (process.env.DATABASE_URL || '').trim();
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = neon(url);
  }
  return _sql;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL, name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, age INT NOT NULL,
    bio TEXT DEFAULT '', avatar TEXT, website TEXT DEFAULT '',
    language TEXT DEFAULT 'ar', theme TEXT DEFAULT 'light',
    followers INT DEFAULT 0, following INT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE, gold BOOLEAN DEFAULT FALSE, points INT DEFAULT 0,
    banned BOOLEAN DEFAULT FALSE, role TEXT DEFAULT 'USER',
    pw_hash TEXT NOT NULL, vault TEXT, attempts INT DEFAULT 0, lockout_until BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'TEXT', text TEXT DEFAULT '', hashtags JSONB DEFAULT '[]', media JSONB DEFAULT '[]',
    like_count INT DEFAULT 0, comment_count INT DEFAULT 0, share_count INT DEFAULT 0,
    save_count INT DEFAULT 0, view_count INT DEFAULT 0, view_bonus_paid BOOLEAN DEFAULT FALSE,
    ai_generated BOOLEAN DEFAULT FALSE, boosted BOOLEAN DEFAULT FALSE, boosted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS post_likes (
    post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS point_awards (
    target_type TEXT NOT NULL, target_id TEXT NOT NULL, user_id TEXT NOT NULL,
    PRIMARY KEY (target_type, target_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS reels (
    id TEXT PRIMARY KEY, author_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    caption TEXT DEFAULT '', hashtags JSONB DEFAULT '[]', media_url TEXT DEFAULT '',
    sound JSONB, duration_sec INT DEFAULT 0,
    like_count INT DEFAULT 0, comment_count INT DEFAULT 0, share_count INT DEFAULT 0, play_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS reel_likes (
    reel_id TEXT REFERENCES reels(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (reel_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
    author_id TEXT REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL,
    like_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id)`,
  `CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (comment_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY, seller_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, description TEXT DEFAULT '', price_cents INT NOT NULL,
    currency TEXT DEFAULT 'EGP', category TEXT DEFAULT 'Other', condition TEXT DEFAULT 'used',
    phone TEXT DEFAULT '', phone_public BOOLEAN DEFAULT FALSE, image TEXT DEFAULT '',
    status TEXT DEFAULT 'available', created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    a_id TEXT REFERENCES users(id) ON DELETE CASCADE, b_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    last_message TEXT DEFAULT '', unread INT DEFAULT 0, is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (a_id, b_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, conv_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT, kind TEXT DEFAULT 'text', text TEXT DEFAULT '', audio TEXT DEFAULT '',
    state TEXT DEFAULT 'sent', created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'system', title TEXT NOT NULL, body TEXT DEFAULT '',
    read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)`,
  `CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    from_id TEXT REFERENCES users(id) ON DELETE CASCADE, to_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING', mutual INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT, content_ref TEXT DEFAULT '', budget_cents INT DEFAULT 50000,
    duration_days INT DEFAULT 7, audience JSONB DEFAULT '{}',
    status TEXT DEFAULT 'PENDING_REVIEW', impressions INT DEFAULT 0, clicks INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS gold_requests (
    id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    package JSONB DEFAULT '{}', status TEXT DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY, actor TEXT DEFAULT '', action TEXT DEFAULT '', target TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ai_chats (
    id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New chat', pinned BOOLEAN DEFAULT FALSE, messages JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sounds (
    id TEXT PRIMARY KEY, title TEXT DEFAULT '', artist TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL, kind TEXT DEFAULT 'text', created_at TIMESTAMPTZ DEFAULT now()
  )`,
];

let _migrated = false;
let _migrating = null;
async function migrate() {
  if (_migrated) return;
  if (_migrating) return _migrating;
  _migrating = (async () => {
    try {
      const s = sql();
      // Sequential: tables reference each other, so order matters.
      for (const stmt of SCHEMA) await s.query(stmt);
      _migrated = true;
    } catch (e) {
      _migrating = null; // allow retry on next request
      throw e;
    }
  })();
  return _migrating;
}

// Every query auto-migrates first (safe on serverless cold starts).
async function q(text, params = []) {
  await migrate();
  return sql().query(text, params);
}

// ---------- helpers ----------
function iso(v) {
  if (!v) return v;
  try { return new Date(v).toISOString(); } catch { return v; }
}
function J(v, fb) {
  if (v === null || v === undefined) return fb;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fb; } }
  return v;
}
const now = () => new Date().toISOString();
const nid = (p) => p + Date.now() + Math.floor(Math.random() * 1e4);

function userRow(r, secret = false) {
  if (!r) return null;
  const u = {
    id: r.id, firstName: r.first_name, lastName: r.last_name, name: r.name,
    username: r.username, email: r.email, age: r.age, bio: r.bio || '', avatar: r.avatar || null,
    website: r.website || '', language: r.language || 'ar', theme: r.theme || 'light',
    followers: r.followers || 0, following: r.following || 0,
    verified: !!r.verified, gold: !!r.gold, points: r.points || 0,
    banned: !!r.banned, role: r.role || 'USER', createdAt: iso(r.created_at),
  };
  if (secret) { u._pw = r.pw_hash; u._vault = r.vault || null; u._attempts = r.attempts || 0; u._lockoutUntil = Number(r.lockout_until || 0); }
  return u;
}
function strip(u) { if (!u) return null; const { _pw, _vault, _attempts, _lockoutUntil, ...r } = u; return r; }
function stripPublic(u) { if (!u) return null; const { _pw, _vault, _attempts, _lockoutUntil, email, ...r } = u; return r; }

function postRow(r) {
  if (!r) return null;
  return {
    id: r.id, authorId: r.author_id, type: r.type, text: r.text || '',
    hashtags: J(r.hashtags, []), media: J(r.media, []),
    likeCount: r.like_count || 0, commentCount: r.comment_count || 0,
    shareCount: r.share_count || 0, saveCount: r.save_count || 0, viewCount: r.view_count || 0,
    viewBonusPaid: !!r.view_bonus_paid, aiGenerated: !!r.ai_generated,
    boosted: !!r.boosted, boostedAt: r.boosted_at ? iso(r.boosted_at) : null,
    createdAt: iso(r.created_at),
  };
}
function reelRow(r) {
  if (!r) return null;
  return {
    id: r.id, authorId: r.author_id, caption: r.caption || '', hashtags: J(r.hashtags, []),
    mediaUrl: r.media_url || '', sound: J(r.sound, null), durationSec: r.duration_sec || 0,
    likeCount: r.like_count || 0, commentCount: r.comment_count || 0,
    shareCount: r.share_count || 0, playCount: r.play_count || 0,
    createdAt: iso(r.created_at),
  };
}
function commentRow(r) {
  if (!r) return null;
  return {
    id: r.id, targetType: r.target_type, targetId: r.target_id, authorId: r.author_id,
    text: r.text || '', likeCount: r.like_count || 0, createdAt: iso(r.created_at),
  };
}
function listingRow(r) {
  if (!r) return null;
  return {
    id: r.id, sellerId: r.seller_id, title: r.title, description: r.description || '',
    priceCents: r.price_cents, currency: r.currency || 'EGP', category: r.category || 'Other',
    condition: r.condition || 'used', phone: r.phone || '', phonePublic: !!r.phone_public,
    image: r.image || '', status: r.status || 'available', createdAt: iso(r.created_at),
  };
}
function convoRow(r) {
  if (!r) return null;
  return {
    id: r.id, title: null, members: [r.a_id, r.b_id],
    lastMessage: r.last_message || '', unread: r.unread || 0,
    online: false, typing: false, updatedAt: iso(r.updated_at),
    private: !!r.is_private, createdAt: iso(r.created_at),
  };
}
function msgRow(r) {
  if (!r) return null;
  return {
    id: r.id, senderId: r.sender_id, kind: r.kind || 'text',
    text: r.text || '', audio: r.audio || '', createdAt: iso(r.created_at), state: r.state || 'sent',
  };
}
function notifRow(r) {
  if (!r) return null;
  return {
    id: r.id, userId: r.user_id, category: r.category || 'system',
    title: r.title || '', body: r.body || '', read: !!r.read, createdAt: iso(r.created_at),
  };
}
function frRow(r) {
  if (!r) return null;
  return {
    id: r.id, fromId: r.from_id, toId: r.to_id, status: r.status || 'PENDING',
    mutual: r.mutual || 0, createdAt: iso(r.created_at),
  };
}
function campRow(r) {
  if (!r) return null;
  return {
    id: r.id, userId: r.user_id, title: r.title || '', contentRef: r.content_ref || '',
    budgetCents: r.budget_cents || 0, durationDays: r.duration_days || 0, audience: J(r.audience, {}),
    status: r.status || 'PENDING_REVIEW', impressions: r.impressions || 0, clicks: r.clicks || 0,
    createdAt: iso(r.created_at),
  };
}
function grRow(r) {
  if (!r) return null;
  return {
    id: r.id, userId: r.user_id, package: J(r.package, {}),
    status: r.status || 'PENDING_REVIEW', createdAt: iso(r.created_at),
  };
}
function auditRow(r) {
  if (!r) return null;
  return { id: r.id, by: r.actor || '', action: r.action || '', target: r.target || '', at: iso(r.created_at), createdAt: iso(r.created_at) };
}
function aiChatRow(r) {
  if (!r) return null;
  return {
    id: r.id, userId: r.user_id, title: r.title || 'New chat',
    pinned: !!r.pinned, messages: J(r.messages, []), createdAt: iso(r.created_at),
  };
}
function soundRow(r) {
  if (!r) return null;
  return { id: r.id, title: r.title || '', artist: r.artist || '', createdAt: iso(r.created_at) };
}
function histRow(r) {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, query: r.query || '', kind: r.kind || 'text', createdAt: iso(r.created_at) };
}

async function notify(userId, { category = 'system', title = '', body = '' } = {}) {
  const rows = await q(
    'INSERT INTO notifications (id, user_id, category, title, body) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [nid('n'), userId, category, title || '', body || '']
  );
  return notifRow(rows[0]);
}
async function notifyAll({ category = 'system', title = '', body = '' } = {}) {
  const rows = await q(
    'INSERT INTO notifications (id, user_id, category, title, body) SELECT gen_random_uuid()::text, id, $1, $2, $3 FROM users RETURNING user_id',
    [category, title || '', body || '']
  );
  return rows.length;
}
async function auditLog(by, action, target = '') {
  await q('INSERT INTO audit (id, actor, action, target) VALUES ($1,$2,$3,$4)', [nid('a'), by || '', action || '', target || '']);
}

const goldPackages = [
  { id: 'g1', name: 'Gold Monthly', priceCents: 19900, durationDays: 30, perks: ['Gold badge', 'Voice AI chat', 'AI agent actions', '5000-char posts', 'Priority AI', 'Exclusive profile ring'] },
  { id: 'g2', name: 'Gold Yearly', priceCents: 199000, durationDays: 365, perks: ['Everything in Monthly', 'Early features', 'Enhanced chat', '2× AI quota'] },
];

module.exports = {
  q, migrate, uuid, now, nid, iso, J,
  userRow, strip, stripPublic, postRow, reelRow, commentRow, listingRow,
  convoRow, msgRow, notifRow, frRow, campRow, grRow, auditRow, aiChatRow, soundRow, histRow,
  notify, notifyAll, auditLog, goldPackages,
};
