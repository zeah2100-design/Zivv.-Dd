const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// Accepted friend ids of a user.
async function friendIds(uid) {
  const rows = await db.q(
    `SELECT CASE WHEN from_id=$1 THEN to_id ELSE from_id END AS fid
     FROM friend_requests WHERE (from_id=$1 OR to_id=$1) AND status='ACCEPTED'`, [uid]);
  return new Set(rows.map((r) => r.fid));
}

// Real mutual-friend counts between me and each id in `ids` (one query).
async function mutualMap(me, ids) {
  const uniq = [...new Set(ids.filter((x) => x && x !== me))];
  if (!uniq.length) return {};
  const mine = await friendIds(me);
  if (!mine.size) return Object.fromEntries(uniq.map((x) => [x, 0]));
  const edges = await db.q(
    `SELECT from_id, to_id FROM friend_requests
     WHERE status='ACCEPTED' AND (from_id = ANY($1) OR to_id = ANY($1))`, [uniq]);
  const adj = {};
  for (const e of edges) {
    (adj[e.from_id] = adj[e.from_id] || new Set()).add(e.to_id);
    (adj[e.to_id] = adj[e.to_id] || new Set()).add(e.from_id);
  }
  const out = {};
  for (const x of uniq) {
    let n = 0;
    for (const f of (adj[x] || [])) if (mine.has(f)) n++;
    out[x] = n;
  }
  return out;
}

async function userMap(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const us = await db.q('SELECT * FROM users WHERE id = ANY($1)', [uniq]);
  return Object.fromEntries(us.map((u) => [u.id, db.strip(db.userRow(u, true))]));
}

// My accepted friends.
router.get('/', requireAuth, async (req, res) => {
  const rows = await db.q(
    `SELECT * FROM friend_requests WHERE (from_id=$1 OR to_id=$1) AND status='ACCEPTED' ORDER BY created_at DESC`,
    [req.user.id]);
  const byId = await userMap(rows.map((f) => (f.from_id === req.user.id ? f.to_id : f.from_id)));
  res.json({
    items: rows
      .map((f) => ({ frId: f.id, since: f.created_at, user: byId[f.from_id === req.user.id ? f.to_id : f.from_id] || null }))
      .filter((x) => x.user && !x.user.banned),
  });
});

router.get('/requests', requireAuth, async (req, res) => {
  const [inc, out, users] = await Promise.all([
    db.q('SELECT * FROM friend_requests WHERE to_id=$1 AND status=$2 ORDER BY created_at DESC', [req.user.id, 'PENDING']),
    db.q('SELECT * FROM friend_requests WHERE from_id=$1 AND status=$2 ORDER BY created_at DESC', [req.user.id, 'PENDING']),
    db.q('SELECT * FROM users WHERE id<>$1 AND banned=FALSE ORDER BY created_at DESC LIMIT 50', [req.user.id]),
  ]);
  const need = [...new Set([...inc.map((f) => f.from_id), ...out.map((f) => f.to_id)])];
  const [byId, mutIn] = await Promise.all([userMap(need), mutualMap(req.user.id, inc.map((f) => f.from_id))]);
  // Suggested: exclude existing friends + anyone with a pending request either way.
  const mine = await friendIds(req.user.id);
  const busy = new Set([...inc.map((f) => f.from_id), ...out.map((f) => f.to_id), ...mine]);
  const sug = users.filter((u) => !busy.has(u.id)).slice(0, 20);
  const mutSug = await mutualMap(req.user.id, sug.map((u) => u.id));
  res.json({
    incoming: inc.map((f) => ({ ...db.frRow(f), mutual: mutIn[f.from_id] || 0, user: byId[f.from_id] || null })),
    outgoing: out.map((f) => ({ ...db.frRow(f), user: byId[f.to_id] || null })),
    suggested: sug.map((u) => ({ ...db.strip(db.userRow(u, true)), mutual: mutSug[u.id] || 0 })),
  });
});

router.post('/requests', requireAuth, async (req, res) => {
  const { toId } = req.body || {};
  if (!toId) return res.status(400).json({ error: 'missing_to' });
  const peer = await db.q('SELECT id, username FROM users WHERE id=$1 AND banned=FALSE', [toId]);
  if (!peer.length || toId === req.user.id) return res.status(400).json({ error: 'bad_user' });
  const dup = await db.q(
    `SELECT * FROM friend_requests
     WHERE ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)) AND status IN ('PENDING','ACCEPTED')`,
    [req.user.id, toId]);
  if (dup.length) return res.status(409).json({ error: dup[0].status === 'ACCEPTED' ? 'already_friends' : 'already_sent' });
  const id = 'f' + Date.now();
  const rows = await db.q(
    'INSERT INTO friend_requests (id, from_id, to_id) VALUES ($1,$2,$3) RETURNING *',
    [id, req.user.id, toId]
  );
  const me = await db.q('SELECT username FROM users WHERE id=$1', [req.user.id]);
  await db.notify(toId, { category: 'friend', title: 'New friend request', body: `@${me[0]?.username || 'someone'} sent you a friend request.` });
  res.status(201).json(db.frRow(rows[0]));
});

router.post('/requests/:id/:action', requireAuth, async (req, res) => {
  const found = await db.q('SELECT * FROM friend_requests WHERE id=$1', [req.params.id]);
  if (!found.length) return res.status(404).json({ error: 'not_found' });
  const f = found[0];
  const a = req.params.action;
  if (a === 'confirm') {
    if (f.to_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    if (f.status !== 'PENDING') return res.status(409).json({ error: 'not_pending' });
    await db.q("UPDATE friend_requests SET status='ACCEPTED' WHERE id=$1", [f.id]);
    // Friends follow each other (real follow graph).
    await db.q('INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2),($2,$1) ON CONFLICT DO NOTHING', [f.from_id, f.to_id]);
    for (const uid of [f.from_id, f.to_id]) {
      await db.q('UPDATE users SET followers=(SELECT COUNT(*) FROM follows WHERE followee_id=$1), following=(SELECT COUNT(*) FROM follows WHERE follower_id=$1) WHERE id=$1', [uid]);
    }
    const me = await db.q('SELECT username FROM users WHERE id=$1', [req.user.id]);
    await db.notify(f.from_id, { category: 'friend', title: 'Request accepted', body: `@${me[0]?.username || 'someone'} accepted your friend request.` });
    return res.json({ ok: true, status: 'ACCEPTED' });
  }
  if (a === 'delete' || a === 'cancel') {
    if (f.from_id !== req.user.id && f.to_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    await db.q("UPDATE friend_requests SET status='CANCELLED' WHERE id=$1", [f.id]);
    return res.json({ ok: true, status: 'CANCELLED' });
  }
  return res.status(400).json({ error: 'bad_action' });
});

// Unfriend / withdraw by request id.
router.delete('/requests/:id', requireAuth, async (req, res) => {
  const found = await db.q('SELECT * FROM friend_requests WHERE id=$1', [req.params.id]);
  if (!found.length) return res.status(404).json({ error: 'not_found' });
  const f = found[0];
  if (f.from_id !== req.user.id && f.to_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  await db.q("UPDATE friend_requests SET status='CANCELLED' WHERE id=$1", [f.id]);
  res.json({ ok: true });
});

module.exports = router;
