const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

function visible(r) {
  const a = S.users.find(u => u.id === r.authorId);
  return a && !a.banned;
}

router.get('/', requireAuth, (req, res) => {
  res.json({ items: S.reels.filter(visible).map(r => ({ ...r, author: S.users.find(u => u.id === r.authorId) })) });
});

router.post('/', requireAuth, (req, res) => {
  const { caption = '', hashtags = [], mediaUrl = '', durationSec = 0, sound = null } = req.body || {};
  if (!caption && !mediaUrl) return res.status(400).json({ error: 'empty_reel' });
  if (mediaUrl && mediaUrl.length > 2.5e6) return res.status(413).json({ error: 'media_too_large' });
  const r = { id: 'r-' + S.uuid().slice(0, 6), authorId: req.user.id, caption, hashtags,
    mediaUrl, sound: sound || null, durationSec: durationSec || 0,
    likeCount: 0, commentCount: 0, shareCount: 0, playCount: 0, createdAt: new Date().toISOString() };
  S.reels.unshift(r);
  res.status(201).json({ ...r, author: S.users.find(u => u.id === r.authorId) });
});

router.post('/:id/like', requireAuth, (req, res) => {
  const r = S.reels.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  r.likeCount++; res.json({ likeCount: r.likeCount, liked: true });
});

router.post('/:id/play', requireAuth, (req, res) => {
  const r = S.reels.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  r.playCount = (r.playCount || 0) + 1; res.json({ playCount: r.playCount });
});

router.get('/sounds/:id', requireAuth, (req, res) => {
  const s = S.sounds.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  const reels = S.reels.filter(r => r.sound && r.sound.title === s.title);
  res.json({ ...s, reels });
});

module.exports = router;
