// Real comments for posts + reels: list, create, like toggle, delete (author/admin).
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const TABLES = { post: 'posts', reel: 'reels' };

function isAdmin(req) {
  return req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
}

// NOTE: /:cid/like must come before /:type/:id so "like" isn't parsed as an id.
router.post('/:cid/like', requireAuth, async (req, res) => {
  const found = await db.q('SELECT id FROM comments WHERE id=$1', [req.params.cid]);
  if (!found.length) return res.status(404).json({ error: 'not_found' });
  const ex = await db.q('SELECT 1 FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [req.params.cid, req.user.id]);
  let liked;
  if (ex.length) {
    await db.q('DELETE FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [req.params.cid, req.user.id]);
    await db.q('UPDATE comments SET like_count=GREATEST(like_count-1,0) WHERE id=$1', [req.params.cid]);
    liked = false;
  } else {
    await db.q('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.cid, req.user.id]);
    await db.q('UPDATE comments SET like_count=like_count+1 WHERE id=$1', [req.params.cid]);
    liked = true;
  }
  const c = await db.q('SELECT like_count FROM comments WHERE id=$1', [req.params.cid]);
  res.json({ liked, likeCount: c[0].like_count });
});

router.get('/:type/:id', requireAuth, async (req, res) => {
  const { type, id } = req.params;
  if (!TABLES[type]) return res.status(400).json({ error: 'bad_type' });
  const rows = await db.q('SELECT * FROM comments WHERE target_type=$1 AND target_id=$2 ORDER BY created_at ASC', [type, id]);
  const aids = [...new Set(rows.map((c) => c.author_id))];
  const cids = rows.map((c) => c.id);
  const [authors, likes] = await Promise.all([
    aids.length ? db.q('SELECT * FROM users WHERE id = ANY($1)', [aids]) : [],
    cids.length ? db.q('SELECT comment_id FROM comment_likes WHERE user_id=$1 AND comment_id = ANY($2)', [req.user.id, cids]) : [],
  ]);
  const byId = Object.fromEntries(authors.map((u) => [u.id, db.strip(db.userRow(u, true))]));
  const likedSet = new Set(likes.map((l) => l.comment_id));
  res.json({ items: rows.map((c) => ({ ...db.commentRow(c), liked: likedSet.has(c.id), author: byId[c.author_id] || null })) });
});

router.post('/:type/:id', requireAuth, async (req, res) => {
  const { type, id } = req.params;
  const { text } = req.body || {};
  if (!TABLES[type]) return res.status(400).json({ error: 'bad_type' });
  const t = await db.q(`SELECT id, author_id FROM ${TABLES[type]} WHERE id=$1`, [id]);
  if (!t.length) return res.status(404).json({ error: 'not_found' });
  if (!text || !text.trim()) return res.status(400).json({ error: 'empty_comment' });
  if (text.length > 500) return res.status(413).json({ error: 'too_long' });
  const cid = 'c-' + db.uuid().slice(0, 6);
  const rows = await db.q(
    'INSERT INTO comments (id, target_type, target_id, author_id, text) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [cid, type, id, req.user.id, text.trim().slice(0, 500)]
  );
  await db.q(`UPDATE ${TABLES[type]} SET comment_count=comment_count+1 WHERE id=$1`, [id]);
  if (t[0].author_id !== req.user.id) {
    const me = await db.q('SELECT name FROM users WHERE id=$1', [req.user.id]);
    await db.notify(t[0].author_id, { category: 'social', title: '💬 تعليق جديد', body: `${me[0]?.name || 'مستخدم'}: ${text.trim().slice(0, 80)}` });
  }
  const a = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  res.status(201).json({ ...db.commentRow(rows[0]), liked: false, author: db.strip(db.userRow(a[0], true)) });
});

router.delete('/:cid', requireAuth, async (req, res) => {
  const found = await db.q('SELECT * FROM comments WHERE id=$1', [req.params.cid]);
  if (!found.length) return res.status(404).json({ error: 'not_found' });
  const c = found[0];
  if (c.author_id !== req.user.id && !isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
  await db.q('DELETE FROM comments WHERE id=$1', [req.params.cid]);
  const tbl = TABLES[c.target_type];
  if (tbl) await db.q(`UPDATE ${tbl} SET comment_count=GREATEST(comment_count-1,0) WHERE id=$1`, [c.target_id]);
  res.json({ ok: true });
});

module.exports = router;
