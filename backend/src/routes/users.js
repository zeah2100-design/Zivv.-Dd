const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

function strip(u) { if (!u) return null; const { _pw, _vault, email, ...r } = u; return r; }

router.get('/:username', requireAuth, (req, res) => {
  const u = S.users.find(x => x.username === req.params.username);
  if (!u || u.banned) return res.status(404).json({ error: 'not_found' });
  const posts = S.posts.filter(p => p.authorId === u.id);
  const reels = S.reels.filter(r => r.authorId === u.id);
  const listings = S.listings.filter(l => l.sellerId === u.id);
  res.json({ user: strip(u), posts, reels, listings, isSelf: u.id === req.user.id, isFollowing: u.id !== req.user.id });
});

router.post('/:id/follow', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.params.id);
  if (!u || u.banned) return res.status(404).json({ error: 'not_found' });
  u.followers++; res.json({ following: true, followers: u.followers });
});

router.patch('/me', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const { name, bio, website, language, theme, avatar } = req.body || {};
  if (avatar && avatar.length > 2.5e6) return res.status(413).json({ error: 'media_too_large' });
  if (avatar !== undefined) u.avatar = avatar;
  if (name) u.name = name; if (bio !== undefined) u.bio = bio;
  if (website !== undefined) u.website = website;
  if (language) u.language = language; if (theme) u.theme = theme;
  const { _pw, _vault, ...safe } = u;
  res.json({ user: safe });
});

module.exports = router;
