// Search + Explore + AI semantic search stub (production: embeddings + pgvector).
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const history = [{ id: 'h1', query: 'football dribbling', kind: 'text' }];

function match(q, ...fields) {
  q = q.toLowerCase();
  return fields.some(f => (f || '').toLowerCase().includes(q));
}

router.get('/suggest', requireAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ users: [], hashtags: [], reels: [] });
  res.json({
    users: S.users.filter(u => match(q, u.name, u.username)).slice(0, 4),
    hashtags: [...new Set(S.posts.flatMap(p => p.hashtags))].filter(h => h.includes(q)).slice(0, 5),
    reels: S.reels.filter(r => match(q, r.caption)).slice(0, 3),
  });
});

router.get('/', requireAuth, (req, res) => {
  const q = req.query.q || '';
  const tab = req.query.tab || 'top';
  const data = {
    users: S.users.filter(u => !q || match(q, u.name, u.username, u.bio)),
    reels: S.reels.filter(r => !q || match(q, r.caption, ...(r.hashtags || []))),
    posts: S.posts.filter(p => !q || match(q, p.text, ...(p.hashtags || []))),
    music: S.sounds.filter(s => !q || match(q, s.title, s.artist)),
    hashtags: [...new Set(S.posts.flatMap(p => p.hashtags))].map(h => ({ tag: h, posts: 1000 + h.length * 137 })),
    store: S.listings.filter(l => !q || match(q, l.title, l.description, l.category)),
  };
  if (q && !history.find(h => h.query === q)) history.unshift({ id: 'h' + Date.now(), query: q, kind: 'text' });
  res.json(tab === 'top' ? data : { [tab]: data[tab] || [] });
});

router.get('/explore', requireAuth, (req, res) => {
  res.json({
    trending: S.posts.slice(0, 3), forYou: S.reels, popularReels: S.reels,
    trendingSounds: S.sounds, trendingHashtags: ['football', 'programming', 'music', 'calm'],
    suggestedAccounts: S.users.filter(u => u.id !== 'u-you'), products: S.listings,
  });
});

// AI semantic search: understands "good football dribbling videos", "calm music", AR/EN.
router.post('/ai', requireAuth, (req, res) => {
  const { query } = req.body || {};
  const q = (query || '').toLowerCase();
  const isAr = /[\u0600-\u06FF]/.test(query || '');
  let picks = { reels: [], posts: [], users: [], music: [] };
  if (/football|كرة|قدم|dribbl|مراوغ/.test(q)) { picks.reels = [S.reels[0]]; picks.posts = [S.posts[0]]; picks.users = [S.users[0]]; }
  else if (/program|cod|برمج/.test(q)) { picks.reels = [S.reels[1]]; picks.posts = [S.posts[1]]; picks.users = [S.users[1]]; }
  else if (/calm|music|هاد|موسيقى|piano/.test(q)) { picks.reels = [S.reels[2]]; picks.posts = [S.posts[2]]; picks.music = S.sounds; picks.users = [S.users[2]]; }
  else { picks.posts = S.posts.slice(0, 2); picks.reels = S.reels.slice(0, 1); }
  res.json({ answer: isAr ? `لقيت أفضل النتائج عن: "${query}" ⚡` : `Best matches for "${query}" ⚡`, ...picks });
});

router.get('/history', requireAuth, (req, res) => res.json({ items: history }));
router.delete('/history', requireAuth, (req, res) => { history.length = 0; res.json({ ok: true }); });
router.delete('/history/:id', requireAuth, (req, res) => {
  const i = history.findIndex(h => h.id === req.params.id); if (i >= 0) history.splice(i, 1);
  res.json({ ok: true });
});

module.exports = router;
