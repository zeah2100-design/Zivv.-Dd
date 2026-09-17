const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

router.get('/:username', requireAuth, (req, res) => {
  const u = S.users.find(x => x.username === req.params.username);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const posts = S.posts.filter(p => p.authorId === u.id);
  const reels = S.reels.filter(r => r.authorId === u.id);
  const listings = S.listings.filter(l => l.sellerId === u.id);
  res.json({ user: u, posts, reels, listings, isSelf: u.id === req.user.id, isFollowing: u.id !== req.user.id });
});

router.post('/:id/follow', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  u.followers++; res.json({ following: true, followers: u.followers });
});

router.patch('/me', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.user.id);
  const { name, bio, website, language, theme } = req.body || {};
  if (name) u.name = name; if (bio !== undefined) u.bio = bio;
  if (website !== undefined) u.website = website;
  if (language) u.language = language; if (theme) u.theme = theme;
  res.json({ user: u });
});

module.exports = router;
