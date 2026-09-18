const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

router.get('/:username', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE LOWER(username)=LOWER($1)', [req.params.username]);
  const u = db.userRow(rows[0]);
  if (!u || u.banned) return res.status(404).json({ error: 'not_found' });
  const [posts, reels, listings] = await Promise.all([
    db.q('SELECT * FROM posts WHERE author_id=$1 ORDER BY created_at DESC', [u.id]),
    db.q('SELECT * FROM reels WHERE author_id=$1 ORDER BY created_at DESC', [u.id]),
    db.q('SELECT * FROM listings WHERE seller_id=$1 ORDER BY created_at DESC', [u.id]),
  ]);
  res.json({
    user: db.stripPublic(u),
    posts: posts.map((r) => db.postRow(r, false)), reels: reels.map(db.reelRow), listings: listings.map((r) => db.listingRow(r, false)),
    isSelf: u.id === req.user.id, isFollowing: u.id !== req.user.id,
  });
});

router.get('/:id/avatar', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT avatar FROM users WHERE id=$1 OR LOWER(username)=LOWER($1)', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ avatar: rows[0].avatar || null });
});

router.post('/:id/follow', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE id=$1', [req.params.id]);
  const u = db.userRow(rows[0]);
  if (!u || u.banned) return res.status(404).json({ error: 'not_found' });
  const upd = await db.q('UPDATE users SET followers=followers+1 WHERE id=$1 RETURNING followers', [u.id]);
  res.json({ following: true, followers: upd[0].followers });
});

router.patch('/me', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const u = db.userRow(rows[0]);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const { name, bio, website, language, theme, avatar } = req.body || {};
  if (avatar && avatar.length > 4.2e6) return res.status(413).json({ error: 'media_too_large' });
  const sets = [], vals = [];
  const set = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
  if (name) set('name', name);
  if (bio !== undefined) set('bio', bio);
  if (website !== undefined) set('website', website);
  if (language) set('language', language);
  if (theme) set('theme', theme);
  if (avatar !== undefined) set('avatar', avatar);
  let out = rows[0];
  if (sets.length) {
    vals.push(req.user.id);
    const upd = await db.q(`UPDATE users SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
    out = upd[0];
  }
  res.json({ user: db.strip(db.userRow(out, true)) });
});

module.exports = router;
