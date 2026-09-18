const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

router.get('/requests', requireAuth, async (req, res) => {
  const [inc, out, users] = await Promise.all([
    db.q('SELECT * FROM friend_requests WHERE to_id=$1 AND status=$2 ORDER BY created_at DESC', [req.user.id, 'PENDING']),
    db.q('SELECT * FROM friend_requests WHERE from_id=$1 AND status=$2 ORDER BY created_at DESC', [req.user.id, 'PENDING']),
    db.q('SELECT * FROM users WHERE id<>$1 AND banned=FALSE ORDER BY created_at DESC LIMIT 50', [req.user.id]),
  ]);
  const need = [...new Set([...inc.map((f) => f.from_id), ...out.map((f) => f.to_id)])];
  const us = need.length ? await db.q('SELECT * FROM users WHERE id = ANY($1)', [need]) : [];
  const byId = Object.fromEntries(us.map((u) => [u.id, db.strip(db.userRow(u, true))]));
  res.json({
    incoming: inc.map((f) => ({ ...db.frRow(f), user: byId[f.from_id] || null })),
    outgoing: out.map((f) => ({ ...db.frRow(f), user: byId[f.to_id] || null })),
    suggested: users.map((u) => ({ ...db.strip(db.userRow(u, true)), mutual: 3 + (u.username.length % 9) })),
  });
});

router.post('/requests', requireAuth, async (req, res) => {
  const { toId } = req.body || {};
  if (!toId) return res.status(400).json({ error: 'missing_to' });
  const peer = await db.q('SELECT id FROM users WHERE id=$1 AND banned=FALSE', [toId]);
  if (!peer.length || toId === req.user.id) return res.status(400).json({ error: 'bad_user' });
  const id = 'f' + Date.now();
  const rows = await db.q(
    'INSERT INTO friend_requests (id, from_id, to_id) VALUES ($1,$2,$3) RETURNING *',
    [id, req.user.id, toId]
  );
  res.status(201).json(db.frRow(rows[0]));
});

router.post('/requests/:id/:action', requireAuth, async (req, res) => {
  const found = await db.q('SELECT * FROM friend_requests WHERE id=$1', [req.params.id]);
  if (!found.length) return res.status(404).json({ error: 'not_found' });
  const a = req.params.action;
  let status = found[0].status;
  if (a === 'confirm') status = 'ACCEPTED';
  else if (a === 'delete' || a === 'cancel') status = 'CANCELLED';
  await db.q('UPDATE friend_requests SET status=$1 WHERE id=$2', [status, req.params.id]);
  res.json({ ok: true, status });
});

module.exports = router;
