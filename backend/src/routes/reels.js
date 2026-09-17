const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  res.json({ items: S.reels.map(r => ({ ...r, author: S.users.find(u => u.id === r.authorId) })) });
});

router.post('/:id/like', requireAuth, (req, res) => {
  const r = S.reels.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  r.likeCount++; res.json({ likeCount: r.likeCount, liked: true });
});

router.get('/sounds/:id', requireAuth, (req, res) => {
  const s = S.sounds.find(x => x.id === req.params.id) || S.sounds[0];
  const reels = S.reels.filter(r => r.sound.title === s.title);
  res.json({ ...s, reels });
});

module.exports = router;
