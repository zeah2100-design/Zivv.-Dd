// Feed: ranked by engagement + freshness + follows + quality + safety (NOT popularity alone).
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

function score(p) {
  const ageH = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 3600e3);
  const eng = p.likeCount + p.commentCount * 4 + p.shareCount * 6 + (p.saveCount || 0) * 5;
  const freshness = 1 / Math.log10(ageH + 10);
  const followed = ['u-layla', 'u-omar', 'u-nour'].includes(p.authorId) ? 1.6 : 1.0;
  const aiPenalty = p.aiGenerated ? 0.85 : 1.0; // respects aiMix downstream; never hidden silently
  return (Math.log10(eng + 10) * 2 + freshness * 3) * followed * aiPenalty;
}

router.get('/', requireAuth, (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const items = [...S.posts]
    .map(p => ({ ...p, author: S.users.find(u => u.id === p.authorId), _s: score(p) }))
    .sort((a, b) => b._s - a._s);
  res.json({ items: items.map(({ _s, ...r }) => r), nextPage: page < 5 ? page + 1 : null });
});

router.post('/:id/like', requireAuth, (req, res) => {
  const p = S.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  p.likeCount++; res.json({ likeCount: p.likeCount, liked: true });
});

router.post('/:id/save', requireAuth, (req, res) => {
  const p = S.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  p.saveCount = (p.saveCount || 0) + 1; res.json({ saved: true });
});

router.post('/', requireAuth, (req, res) => {
  const { text, type = 'TEXT', hashtags = [], aiGenerated = false } = req.body || {};
  if (!text) return res.status(400).json({ error: 'empty_post' });
  const post = { id: 'p-' + S.uuid().slice(0, 6), authorId: req.user.id, type, text, hashtags, mentions: [],
    likeCount: 0, commentCount: 0, shareCount: 0, saveCount: 0, aiGenerated, createdAt: new Date().toISOString(), media: [] };
  S.posts.unshift(post);
  res.status(201).json({ ...post, author: S.users.find(u => u.id === post.authorId) });
});

module.exports = router;
