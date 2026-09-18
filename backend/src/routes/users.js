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
  const fol = u.id === req.user.id ? [] : await db.q('SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2', [req.user.id, u.id]);
  res.json({
    user: db.stripPublic(u),
    posts: posts.map((r) => db.postRow(r, false)), reels: reels.map((r) => db.reelRow(r, false)), listings: listings.map((r) => db.listingRow(r, false)),
    isSelf: u.id === req.user.id, isFollowing: fol.length > 0,
  });
});

router.get('/:id/avatar', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT avatar FROM users WHERE id=$1 OR LOWER(username)=LOWER($1)', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ avatar: rows[0].avatar || null });
});

router.post('/:id/follow', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE id=$1 OR LOWER(username)=LOWER($1)', [req.params.id]);
  const u = db.userRow(rows[0]);
  if (!u || u.banned) return res.status(404).json({ error: 'not_found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'self' });
  const ex = await db.q('SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2', [req.user.id, u.id]);
  let following;
  if (ex.length) {
    await db.q('DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2', [req.user.id, u.id]);
    following = false;
  } else {
    await db.q('INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, u.id]);
    following = true;
    if (u.id !== req.user.id) {
      const me = await db.q('SELECT username FROM users WHERE id=$1', [req.user.id]);
      await db.notify(u.id, { category: 'follow', title: 'New follower', body: `@${me[0]?.username || 'someone'} started following you.` });
    }
  }
  // Self-healing counters: always recomputed from the follows table.
  await db.q('UPDATE users SET followers=(SELECT COUNT(*) FROM follows WHERE followee_id=$1) WHERE id=$1', [u.id]);
  await db.q('UPDATE users SET following=(SELECT COUNT(*) FROM follows WHERE follower_id=$1) WHERE id=$1', [req.user.id]);
  const c = await db.q('SELECT followers FROM users WHERE id=$1', [u.id]);
  res.json({ following, followers: c[0].followers });
});

router.get('/:id/followers', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE id=$1 OR LOWER(username)=LOWER($1)', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const fr = await db.q('SELECT u.* FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.followee_id=$1 AND u.banned=FALSE ORDER BY f.created_at DESC LIMIT 100', [rows[0].id]);
  res.json({ items: fr.map((x) => db.strip(db.userRow(x, true))) });
});

router.get('/:id/following', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE id=$1 OR LOWER(username)=LOWER($1)', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const fg = await db.q('SELECT u.* FROM follows f JOIN users u ON u.id=f.followee_id WHERE f.follower_id=$1 AND u.banned=FALSE ORDER BY f.created_at DESC LIMIT 100', [rows[0].id]);
  res.json({ items: fg.map((x) => db.strip(db.userRow(x, true))) });
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
