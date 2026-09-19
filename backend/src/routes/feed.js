// Feed: ranked by engagement + freshness + quality. Points: 10,000 views on ONE
// post = 1,000 points (once per post); likes received also earn +2 pts.
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const TYPES = new Set(['TEXT', 'IMAGE', 'VIDEO', 'MUSIC']);

function score(p) {
  const ageH = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 3600e3);
  const eng = p.likeCount + p.commentCount * 4 + p.shareCount * 6 + (p.saveCount || 0) * 5 + (p.viewCount || 0) / 50;
  const freshness = 1 / Math.log10(ageH + 10);
  const aiPenalty = p.aiGenerated ? 0.85 : 1.0;
  const boost = p.boosted ? 5 : 1; // King boost: 5x reach
  return (Math.log10(eng + 10) * 2 + freshness * 3) * aiPenalty * boost;
}

router.get('/', requireAuth, async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const rows = await db.q(
    `SELECT p.* FROM posts p JOIN users u ON u.id=p.author_id AND u.banned=FALSE
     ORDER BY p.created_at DESC LIMIT 30`
  );
  const items = rows.map((r) => db.postRow(r, false));
  const aids = [...new Set(items.map((p) => p.authorId))];
  const pids = items.map((p) => p.id);
  const [authors, likes] = await Promise.all([
    aids.length ? db.q('SELECT * FROM users WHERE id = ANY($1)', [aids]) : [],
    pids.length ? db.q('SELECT post_id FROM post_likes WHERE user_id=$1 AND post_id = ANY($2)', [req.user.id, pids]) : [],
  ]);
  const byId = Object.fromEntries(authors.map((u) => [u.id, db.strip(db.userRow(u, true))]));
  const likedSet = new Set(likes.map((l) => l.post_id));
  const ranked = items
    .map((p) => ({ ...p, liked: likedSet.has(p.id), author: byId[p.authorId] || null, _s: score(p) }))
    .sort((a, b) => b._s - a._s)
    .map(({ _s, ...r }) => r);
  res.json({ items: ranked, nextPage: page < 5 ? page + 1 : null });
});

router.get('/:id/media', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT media FROM posts WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ media: db.J(rows[0].media, []) });
});

router.post('/:id/like', requireAuth, async (req, res) => {
  const found = await db.q('SELECT id, author_id FROM posts WHERE id=$1', [req.params.id]);
  if (!found.length) return res.status(404).json({ error: 'not_found' });
  const p = found[0];
  const ex = await db.q('SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2', [p.id, req.user.id]);
  let liked;
  if (ex.length) {
    await db.q('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [p.id, req.user.id]);
    await db.q('UPDATE posts SET like_count=GREATEST(like_count-1,0) WHERE id=$1', [p.id]);
    liked = false;
  } else {
    await db.q('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, req.user.id]);
    await db.q('UPDATE posts SET like_count=like_count+1 WHERE id=$1', [p.id]);
    liked = true;
    if (p.author_id !== req.user.id) {
      const award = await db.q(
        'INSERT INTO point_awards (target_type, target_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id',
        ['post', p.id, req.user.id]
      );
      if (award.length) await db.q('UPDATE users SET points=points+2 WHERE id=$1', [p.author_id]);
    }
  }
  const c = await db.q('SELECT like_count FROM posts WHERE id=$1', [p.id]);
  res.json({ likeCount: c[0].like_count, liked });
});

router.post('/:id/share', requireAuth, async (req, res) => {
  const upd = await db.q('UPDATE posts SET share_count=share_count+1 WHERE id=$1 RETURNING share_count', [req.params.id]);
  if (!upd.length) return res.status(404).json({ error: 'not_found' });
  res.json({ shareCount: upd[0].share_count });
});

router.post('/:id/save', requireAuth, async (req, res) => {
  const upd = await db.q('UPDATE posts SET save_count=save_count+1 WHERE id=$1 RETURNING id', [req.params.id]);
  if (!upd.length) return res.status(404).json({ error: 'not_found' });
  res.json({ saved: true });
});

// View tracking → 10k views on one post pays 1,000 pts once.
router.post('/:id/view', requireAuth, async (req, res) => {
  const rows = await db.q('UPDATE posts SET view_count=view_count+1 WHERE id=$1 RETURNING view_count, view_bonus_paid, author_id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const r = rows[0];
  let bonus = false;
  if (r.view_count >= 10000 && !r.view_bonus_paid) {
    const took = await db.q('UPDATE posts SET view_bonus_paid=TRUE WHERE id=$1 AND view_bonus_paid=FALSE RETURNING id', [req.params.id]);
    if (took.length) {
      bonus = true;
      await db.q('UPDATE users SET points=points+1000 WHERE id=$1', [r.author_id]);
      await db.notify(r.author_id, { category: 'gold', title: '+1,000 points!', body: 'One of your posts hit 10,000 views. Redeem ZIVV Gold.' });
    }
  }
  res.json({ viewCount: r.view_count, bonus });
});

router.post('/', requireAuth, async (req, res) => {
  const meRows = await db.q('SELECT gold FROM users WHERE id=$1', [req.user.id]);
  const { text, type = 'TEXT', hashtags = [], aiGenerated = false, mediaUrl = '', durationSec = 0 } = req.body || {};
  if (!text && !mediaUrl) return res.status(400).json({ error: 'empty_post' });
  if (!TYPES.has(type)) return res.status(400).json({ error: 'bad_type' });
  const max = meRows[0]?.gold ? 5000 : 2000; // Gold perk: longer posts
  if ((text || '').length > max) return res.status(413).json({ error: 'too_long', max });
  if (mediaUrl && mediaUrl.length > 4.4e6) return res.status(413).json({ error: 'media_too_large' });
  const kind = type === 'IMAGE' ? 'IMAGE' : type === 'VIDEO' ? 'VIDEO' : type === 'MUSIC' ? 'AUDIO' : 'TEXT';
  const id = 'p-' + db.uuid().slice(0, 6);
  const media = mediaUrl ? [{ kind, cdnUrl: mediaUrl, durationSec: durationSec || 0 }] : [];
  const rows = await db.q(
    `INSERT INTO posts (id, author_id, type, text, hashtags, media, ai_generated)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, req.user.id, type, text || '', JSON.stringify(hashtags || []), JSON.stringify(media), !!aiGenerated]
  );
  const post = db.postRow(rows[0]);
  const a = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  res.status(201).json({ ...post, author: db.strip(db.userRow(a[0], true)) });
});

module.exports = router;
