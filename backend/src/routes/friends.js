const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

router.get('/requests', requireAuth, (req, res) => {
  const incoming = S.friendRequests.filter(f => f.toId === req.user.id && f.status === 'PENDING')
    .map(f => ({ ...f, user: S.users.find(u => u.id === f.fromId) }));
  const outgoing = S.friendRequests.filter(f => f.fromId === req.user.id && f.status === 'PENDING')
    .map(f => ({ ...f, user: S.users.find(u => u.id === f.toId) }));
  const suggested = S.users.filter(u => u.id !== req.user.id).map(u => ({ ...u, mutual: 3 + u.username.length % 9 }));
  res.json({ incoming, outgoing, suggested });
});

router.post('/requests', requireAuth, (req, res) => {
  const { toId } = req.body || {};
  if (!toId) return res.status(400).json({ error: 'missing_to' });
  const r = { id: 'f' + Date.now(), fromId: req.user.id, toId, status: 'PENDING', mutual: 0, createdAt: new Date().toISOString() };
  S.friendRequests.push(r); res.status(201).json(r);
});

router.post('/requests/:id/:action', requireAuth, (req, res) => {
  const r = S.friendRequests.find(f => f.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  const a = req.params.action;
  if (a === 'confirm') r.status = 'ACCEPTED';
  else if (a === 'delete' || a === 'cancel') r.status = 'CANCELLED';
  res.json({ ok: true, status: r.status });
});

module.exports = router;
