// Feed: ranked by engagement + freshness + quality. Points: 10,000 views on ONE
// post = 1,000 points (once per post); likes received also earn +2 pts.
const router = require('express').Router();
const S = require('../lib/store');
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

function visible(p) {
  const a = S.users.find(u => u.id === p.authorId);
  return a && !a.banned;
}

router.get('/', requireAuth, (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const items = S.posts.filter(visible)
    .map(p => ({ ...p, author: S.users.find(u => u.id === p.authorId), _s: score(p) }))
    .sort((a, b) => b._s - a._s);
  res.json({ items: items.map(({ _s, ...r }) => r), nextPage: page < 5 ? page + 1 : null });
});

router.post('/:id/like', requireAuth, (req, res) => {
  const p = S.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  p.likeCount++;
  if (p.authorId !== req.user.id) {
    const a = S.users.find(u => u.id === p.authorId);
    if (a) a.points = (a.points || 0) + 2;
  }
  res.json({ likeCount: p.likeCount, liked: true });
});

router.post('/:id/save', requireAuth, (req, res) => {
  const p = S.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  p.saveCount = (p.saveCount || 0) + 1; res.json({ saved: true });
});

// View tracking → 10k views on one post pays 1,000 pts once.
router.post('/:id/view', requireAuth, (req, res) => {
  const p = S.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  p.viewCount = (p.viewCount || 0) + 1;
  let bonus = false;
  if (p.viewCount >= 10000 && !p.viewBonusPaid) {
    p.viewBonusPaid = true; bonus = true;
    const a = S.users.find(u => u.id === p.authorId);
    if (a) {
      a.points = (a.points || 0) + 1000;
      S.notify(a.id, { category: 'gold', title: '+1,000 points!', body: 'One of your posts hit 10,000 views. Redeem ZIVV Gold.' });
    }
  }
  res.json({ viewCount: p.viewCount, bonus });
});

router.post('/', requireAuth, (req, res) => {
  const me = S.users.find(u => u.id === req.user.id);
  const { text, type = 'TEXT', hashtags = [], aiGenerated = false, mediaUrl = '', durationSec = 0 } = req.body || {};
  if (!text && !mediaUrl) return res.status(400).json({ error: 'empty_post' });
  if (!TYPES.has(type)) return res.status(400).json({ error: 'bad_type' });
  const max = me?.gold ? 5000 : 2000; // Gold perk: longer posts
  if ((text || '').length > max) return res.status(413).json({ error: 'too_long', max });
  if (mediaUrl && mediaUrl.length > 2.5e6) return res.status(413).json({ error: 'media_too_large' });
  const kind = type === 'IMAGE' ? 'IMAGE' : type === 'VIDEO' ? 'VIDEO' : type === 'MUSIC' ? 'AUDIO' : 'TEXT';
  const post = { id: 'p-' + S.uuid().slice(0, 6), authorId: req.user.id, type, text: text || '', hashtags, mentions: [],
    likeCount: 0, commentCount: 0, shareCount: 0, saveCount: 0, viewCount: 0,
    aiGenerated, createdAt: new Date().toISOString(),
    media: mediaUrl ? [{ kind, cdnUrl: mediaUrl, durationSec: durationSec || 0 }] : [] };
  S.posts.unshift(post);
  res.status(201).json({ ...post, author: S.users.find(u => u.id === post.authorId) });
});

module.exports = router;
