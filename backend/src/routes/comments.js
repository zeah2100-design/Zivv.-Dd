// Real comments for posts + reels: list, create, like toggle, delete (author/admin).
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

S.comments = S.comments || [];

function targetOf(type, id) {
  return type === 'post' ? S.posts.find(x => x.id === id) : S.reels.find(x => x.id === id);
}
function strip(u) { if (!u) return null; const { _pw, _vault, email, ...r } = u; return r; }
function isAdmin(req) {
  return req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
}

// NOTE: /:cid/like must come before /:type/:id so "like" isn't parsed as an id.
router.post('/:cid/like', requireAuth, (req, res) => {
  const c = S.comments.find(x => x.id === req.params.cid);
  if (!c) return res.status(404).json({ error: 'not_found' });
  c.likedBy = c.likedBy || [];
  const i = c.likedBy.indexOf(req.user.id);
  let liked;
  if (i >= 0) { c.likedBy.splice(i, 1); c.likeCount = Math.max(0, (c.likeCount || 1) - 1); liked = false; }
  else { c.likedBy.push(req.user.id); c.likeCount = (c.likeCount || 0) + 1; liked = true; }
  res.json({ liked, likeCount: c.likeCount });
});

router.get('/:type/:id', requireAuth, (req, res) => {
  const { type, id } = req.params;
  if (!['post', 'reel'].includes(type)) return res.status(400).json({ error: 'bad_type' });
  const items = S.comments
    .filter(c => c.targetType === type && c.targetId === id)
    .map(c => ({ ...c, liked: (c.likedBy || []).includes(req.user.id), author: strip(S.users.find(u => u.id === c.authorId)) }))
    .map(({ likedBy, ...r }) => r);
  res.json({ items });
});

router.post('/:type/:id', requireAuth, (req, res) => {
  const { type, id } = req.params;
  const { text } = req.body || {};
  if (!['post', 'reel'].includes(type)) return res.status(400).json({ error: 'bad_type' });
  const t = targetOf(type, id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (!text || !text.trim()) return res.status(400).json({ error: 'empty_comment' });
  if (text.length > 500) return res.status(413).json({ error: 'too_long' });
  const c = {
    id: 'c-' + S.uuid().slice(0, 6), targetType: type, targetId: id, authorId: req.user.id,
    text: text.trim().slice(0, 500), likeCount: 0, likedBy: [], createdAt: new Date().toISOString(),
  };
  S.comments.push(c);
  t.commentCount = (t.commentCount || 0) + 1;
  if (t.authorId !== req.user.id) {
    const me = S.users.find(u => u.id === req.user.id);
    S.notify(t.authorId, { category: 'social', title: '💬 تعليق جديد', body: `${me?.name || 'مستخدم'}: ${c.text.slice(0, 80)}` });
  }
  res.status(201).json({ ...c, liked: false, author: strip(S.users.find(u => u.id === c.authorId)) });
});

router.delete('/:cid', requireAuth, (req, res) => {
  const i = S.comments.findIndex(x => x.id === req.params.cid);
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  const c = S.comments[i];
  if (c.authorId !== req.user.id && !isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
  S.comments.splice(i, 1);
  const t = targetOf(c.targetType, c.targetId);
  if (t) t.commentCount = Math.max(0, (t.commentCount || 1) - 1);
  res.json({ ok: true });
});

module.exports = router;
