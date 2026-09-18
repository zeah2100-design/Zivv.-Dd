// Search + Explore + AI semantic search stub (production: embeddings + pgvector).
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

router.get('/suggest', requireAuth, async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ users: [], hashtags: [], reels: [] });
  const like = `%${q}%`;
  const [users, tags, reels] = await Promise.all([
    db.q('SELECT * FROM users WHERE banned=FALSE AND (LOWER(name) LIKE $1 OR LOWER(username) LIKE $1) LIMIT 4', [like]),
    db.q('SELECT DISTINCT h FROM (SELECT jsonb_array_elements_text(hashtags) AS h FROM posts) t WHERE LOWER(h) LIKE $1 LIMIT 5', [like]),
    db.q('SELECT * FROM reels WHERE LOWER(caption) LIKE $1 ORDER BY created_at DESC LIMIT 3', [like]),
  ]);
  res.json({
    users: users.map((u) => db.strip(db.userRow(u, true))),
    hashtags: tags.map((t) => t.h),
    reels: reels.map(db.reelRow),
  });
});

router.get('/', requireAuth, async (req, res) => {
  const q = req.query.q || '';
  const tab = req.query.tab || 'top';
  const like = `%${q.toLowerCase()}%`;
  const [users, reels, posts, music, tags, store] = await Promise.all([
    q ? db.q('SELECT * FROM users WHERE banned=FALSE AND (LOWER(name) LIKE $1 OR LOWER(username) LIKE $1 OR LOWER(bio) LIKE $1) LIMIT 30', [like])
      : db.q('SELECT * FROM users WHERE banned=FALSE ORDER BY created_at DESC LIMIT 30'),
    q ? db.q('SELECT * FROM reels WHERE LOWER(caption) LIKE $1 OR LOWER(hashtags::text) LIKE $1 ORDER BY created_at DESC LIMIT 30', [like])
      : db.q('SELECT * FROM reels ORDER BY created_at DESC LIMIT 30'),
    q ? db.q('SELECT * FROM posts WHERE LOWER(text) LIKE $1 OR LOWER(hashtags::text) LIKE $1 ORDER BY created_at DESC LIMIT 30', [like])
      : db.q('SELECT * FROM posts ORDER BY created_at DESC LIMIT 30'),
    q ? db.q('SELECT * FROM sounds WHERE LOWER(title) LIKE $1 OR LOWER(artist) LIKE $1 LIMIT 20', [like])
      : db.q('SELECT * FROM sounds ORDER BY created_at DESC LIMIT 20'),
    db.q(`SELECT h AS tag, COUNT(*)::int AS posts FROM
      (SELECT jsonb_array_elements_text(hashtags) AS h FROM posts) t GROUP BY h ORDER BY posts DESC LIMIT 30`),
    q ? db.q('SELECT * FROM listings WHERE LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1 ORDER BY created_at DESC LIMIT 30', [like])
      : db.q('SELECT * FROM listings ORDER BY created_at DESC LIMIT 30'),
  ]);
  const data = {
    users: users.map((u) => db.strip(db.userRow(u, true))),
    reels: reels.map(db.reelRow),
    posts: posts.map((x) => db.postRow(x, false)),
    music: music.map(db.soundRow),
    hashtags: tags,
    store: store.map((x) => db.listingRow(x, false)),
  };
  if (q) {
    const ex = await db.q('SELECT id FROM search_history WHERE user_id=$1 AND query=$2', [req.user.id, q]);
    if (!ex.length) await db.q('INSERT INTO search_history (id, user_id, query) VALUES ($1,$2,$3)', ['h' + Date.now(), req.user.id, q]);
  }
  res.json(tab === 'top' ? data : { [tab]: data[tab] || [] });
});

router.get('/explore', requireAuth, async (req, res) => {
  const [posts, reels, sounds, tags, users, listings] = await Promise.all([
    db.q('SELECT * FROM posts ORDER BY created_at DESC LIMIT 3'),
    db.q('SELECT * FROM reels ORDER BY created_at DESC LIMIT 30'),
    db.q('SELECT * FROM sounds ORDER BY created_at DESC LIMIT 20'),
    db.q('SELECT DISTINCT h FROM (SELECT jsonb_array_elements_text(hashtags) AS h FROM posts) t LIMIT 8'),
    db.q('SELECT * FROM users WHERE banned=FALSE AND id<>$1 ORDER BY created_at DESC LIMIT 30', [req.user.id]),
    db.q('SELECT * FROM listings ORDER BY created_at DESC LIMIT 30'),
  ]);
  res.json({
    trending: posts.map((x) => db.postRow(x, false)), forYou: reels.map(db.reelRow), popularReels: reels.map(db.reelRow),
    trendingSounds: sounds.map(db.soundRow), trendingHashtags: tags.map((t) => t.h),
    suggestedAccounts: users.map((u) => db.strip(db.userRow(u, true))), products: listings.map((x) => db.listingRow(x, false)),
  });
});

// AI semantic search: matches real content, AR/EN.
router.post('/ai', requireAuth, async (req, res) => {
  const { query } = req.body || {};
  const q = (query || '').toLowerCase();
  const like = `%${q}%`;
  const isAr = /[\u0600-\u06FF]/.test(query || '');
  const [reels, posts, users, music] = await Promise.all([
    db.q('SELECT * FROM reels WHERE LOWER(caption) LIKE $1 OR LOWER(hashtags::text) LIKE $1 ORDER BY created_at DESC LIMIT 3', [like]),
    db.q('SELECT * FROM posts WHERE LOWER(text) LIKE $1 OR LOWER(hashtags::text) LIKE $1 ORDER BY created_at DESC LIMIT 3', [like]),
    db.q('SELECT * FROM users WHERE banned=FALSE AND (LOWER(name) LIKE $1 OR LOWER(username) LIKE $1 OR LOWER(bio) LIKE $1) LIMIT 3', [like]),
    db.q('SELECT * FROM sounds WHERE LOWER(title) LIKE $1 OR LOWER(artist) LIKE $1 LIMIT 3', [like]),
  ]);
  const picks = {
    reels: reels.map(db.reelRow), posts: posts.map((x) => db.postRow(x, false)),
    users: users.map((u) => db.strip(db.userRow(u, true))), music: music.map(db.soundRow),
  };
  const n = picks.reels.length + picks.posts.length + picks.users.length;
  res.json({ answer: n ? (isAr ? `لقيت ${n} نتائج عن: "${query}"` : `Found ${n} matches for "${query}"`) : (isAr ? `لا توجد نتائج عن: "${query}"` : `No matches for "${query}"`), ...picks });
});

router.get('/history', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM search_history WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ items: rows.map(db.histRow) });
});
router.delete('/history', requireAuth, async (req, res) => {
  await db.q('DELETE FROM search_history WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
});
router.delete('/history/:id', requireAuth, async (req, res) => {
  await db.q('DELETE FROM search_history WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
