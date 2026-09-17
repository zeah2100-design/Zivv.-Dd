// Search + Explore + AI semantic search stub (production: embeddings + pgvector).
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const history = []; // {id,userId,query,kind}

function match(q, ...fields) {
  q = q.toLowerCase();
  return fields.some(f => (f || '').toLowerCase().includes(q));
}
function active(u) { return u && !u.banned; }

router.get('/suggest', requireAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ users: [], hashtags: [], reels: [] });
  res.json({
    users: S.users.filter(u => active(u) && match(q, u.name, u.username)).slice(0, 4),
    hashtags: [...new Set(S.posts.flatMap(p => p.hashtags))].filter(h => h.includes(q)).slice(0, 5),
    reels: S.reels.filter(r => match(q, r.caption)).slice(0, 3),
  });
});

router.get('/', requireAuth, (req, res) => {
  const q = req.query.q || '';
  const tab = req.query.tab || 'top';
  const data = {
    users: S.users.filter(u => active(u) && (!q || match(q, u.name, u.username, u.bio))),
    reels: S.reels.filter(r => !q || match(q, r.caption, ...(r.hashtags || []))),
    posts: S.posts.filter(p => !q || match(q, p.text, ...(p.hashtags || []))),
    music: S.sounds.filter(s => !q || match(q, s.title, s.artist)),
    hashtags: [...new Set(S.posts.flatMap(p => p.hashtags))].map(h => ({ tag: h, posts: S.posts.filter(p => p.hashtags.includes(h)).length })),
    store: S.listings.filter(l => !q || match(q, l.title, l.description, l.category)),
  };
  if (q && !history.find(h => h.query === q && h.userId === req.user.id)) history.unshift({ id: 'h' + Date.now(), userId: req.user.id, query: q, kind: 'text' });
  res.json(tab === 'top' ? data : { [tab]: data[tab] || [] });
});

router.get('/explore', requireAuth, (req, res) => {
  res.json({
    trending: S.posts.slice(0, 3), forYou: S.reels, popularReels: S.reels,
    trendingSounds: S.sounds, trendingHashtags: [...new Set(S.posts.flatMap(p => p.hashtags))].slice(0, 8),
    suggestedAccounts: S.users.filter(u => active(u) && u.id !== req.user.id), products: S.listings,
  });
});

// AI semantic search: matches real content, AR/EN.
router.post('/ai', requireAuth, (req, res) => {
  const { query } = req.body || {};
  const q = (query || '').toLowerCase();
  const isAr = /[\u0600-\u06FF]/.test(query || '');
  const picks = {
    reels: S.reels.filter(r => match(q, r.caption, ...(r.hashtags || []))).slice(0, 3),
    posts: S.posts.filter(p => match(q, p.text, ...(p.hashtags || []))).slice(0, 3),
    users: S.users.filter(u => active(u) && match(q, u.name, u.username, u.bio)).slice(0, 3),
    music: S.sounds.filter(s => match(q, s.title, s.artist)).slice(0, 3),
  };
  const n = picks.reels.length + picks.posts.length + picks.users.length;
  res.json({ answer: n ? (isAr ? `لقيت ${n} نتائج عن: "${query}"` : `Found ${n} matches for "${query}"`) : (isAr ? `لا توجد نتائج عن: "${query}"` : `No matches for "${query}"`), ...picks });
});

router.get('/history', requireAuth, (req, res) => res.json({ items: history.filter(h => h.userId === req.user.id) }));
router.delete('/history', requireAuth, (req, res) => {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].userId === req.user.id) history.splice(i, 1);
  res.json({ ok: true });
});
router.delete('/history/:id', requireAuth, (req, res) => {
  const i = history.findIndex(h => h.id === req.params.id && h.userId === req.user.id);
  if (i >= 0) history.splice(i, 1);
  res.json({ ok: true });
});

module.exports = router;
