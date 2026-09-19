const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const rows = await db.q(
    `SELECT r.* FROM reels r JOIN users u ON u.id=r.author_id AND u.banned=FALSE
     ORDER BY r.created_at DESC LIMIT 30`
  );
  const items = rows.map((r) => db.reelRow(r, false));
  const aids = [...new Set(items.map((r) => r.authorId))];
  const rids = items.map((r) => r.id);
  const [authors, likes] = await Promise.all([
    aids.length ? db.q('SELECT * FROM users WHERE id = ANY($1)', [aids]) : [],
    rids.length ? db.q('SELECT reel_id FROM reel_likes WHERE user_id=$1 AND reel_id = ANY($2)', [req.user.id, rids]) : [],
  ]);
  const byId = Object.fromEntries(authors.map((u) => [u.id, db.strip(db.userRow(u, true))]));
  const likedSet = new Set(likes.map((l) => l.reel_id));
  res.json({ items: items.map((r) => ({ ...r, liked: likedSet.has(r.id), author: byId[r.authorId] || null })) });
});

router.post('/', requireAuth, async (req, res) => {
  const { caption = '', hashtags = [], mediaUrl = '', durationSec = 0, sound = null } = req.body || {};
  if (!caption && !mediaUrl) return res.status(400).json({ error: 'empty_reel' });
  if (mediaUrl && mediaUrl.length > 4.4e6) return res.status(413).json({ error: 'media_too_large' });
  const id = 'r-' + db.uuid().slice(0, 6);
  const rows = await db.q(
    `INSERT INTO reels (id, author_id, caption, hashtags, media_url, sound, duration_sec)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, req.user.id, caption, JSON.stringify(hashtags || []), mediaUrl, sound ? JSON.stringify(sound) : null, durationSec || 0]
  );
  const r = db.reelRow(rows[0], true);
  const a = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  res.status(201).json({ ...r, author: db.strip(db.userRow(a[0], true)) });
});

router.get('/:id/media', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT media_url FROM reels WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const { resolveUrl } = require('../lib/storage');
  res.json({ mediaUrl: await resolveUrl(rows[0].media_url || '') });
});

router.post('/:id/share', requireAuth, async (req, res) => {
  const upd = await db.q('UPDATE reels SET share_count=share_count+1 WHERE id=$1 RETURNING share_count', [req.params.id]);
  if (!upd.length) return res.status(404).json({ error: 'not_found' });
  res.json({ shareCount: upd[0].share_count });
});

router.post('/:id/like', requireAuth, async (req, res) => {
  const found = await db.q('SELECT id, author_id FROM reels WHERE id=$1', [req.params.id]);
  if (!found.length) return res.status(404).json({ error: 'not_found' });
  const r = found[0];
  const ex = await db.q('SELECT 1 FROM reel_likes WHERE reel_id=$1 AND user_id=$2', [r.id, req.user.id]);
  let liked;
  if (ex.length) {
    await db.q('DELETE FROM reel_likes WHERE reel_id=$1 AND user_id=$2', [r.id, req.user.id]);
    await db.q('UPDATE reels SET like_count=GREATEST(like_count-1,0) WHERE id=$1', [r.id]);
    liked = false;
  } else {
    await db.q('INSERT INTO reel_likes (reel_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.id, req.user.id]);
    await db.q('UPDATE reels SET like_count=like_count+1 WHERE id=$1', [r.id]);
    liked = true;
    if (r.author_id !== req.user.id) {
      const award = await db.q(
        'INSERT INTO point_awards (target_type, target_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id',
        ['reel', r.id, req.user.id]
      );
      if (award.length) await db.q('UPDATE users SET points=points+2 WHERE id=$1', [r.author_id]);
    }
  }
  const c = await db.q('SELECT like_count FROM reels WHERE id=$1', [r.id]);
  res.json({ likeCount: c[0].like_count, liked });
});

router.post('/:id/play', requireAuth, async (req, res) => {
  const rows = await db.q('UPDATE reels SET play_count=play_count+1 WHERE id=$1 RETURNING play_count', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ playCount: rows[0].play_count });
});

router.get('/sounds/:id', requireAuth, async (req, res) => {
  const sRows = await db.q('SELECT * FROM sounds WHERE id=$1', [req.params.id]);
  if (!sRows.length) return res.status(404).json({ error: 'not_found' });
  const s = db.soundRow(sRows[0]);
  const reels = await db.q("SELECT * FROM reels WHERE sound->>'title' = $1 ORDER BY created_at DESC LIMIT 50", [s.title]);
  res.json({ ...s, reels: reels.map((r) => db.reelRow(r, false)) });
});

module.exports = router;
