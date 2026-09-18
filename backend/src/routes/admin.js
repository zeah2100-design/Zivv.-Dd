// KING admin: hidden UX client-side; REAL security here — role check + audit + rate limits.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const db = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkPassword, signAccess } = require('../lib/auth');

const adminLoginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 10 });
const gate = [requireAuth, requireRole('ADMIN', 'SUPERADMIN')];

router.post('/login', adminLoginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_BOOTSTRAP_USER || 'king';
  const expectedHash = process.env.ADMIN_BOOTSTRAP_PASS_HASH || '';
  if (username !== expectedUser) return res.status(401).json({ error: 'bad_credentials' });
  if (expectedHash) {
    if (!(await checkPassword(password || '', expectedHash))) return res.status(401).json({ error: 'bad_credentials' });
  } else if ((password || '').length < 8) {
    return res.status(401).json({ error: 'admin_not_bootstrapped' });
  }
  await db.auditLog(username, 'admin_login', '');
  res.json({ access: signAccess({ id: 'admin-1', username, role: 'ADMIN' }), role: 'ADMIN' });
});

router.get('/stats', gate, async (req, res) => {
  const [u, p, r, c, m, l, camp, g, pg, pa] = await Promise.all([
    db.q('SELECT COUNT(*)::int AS c FROM users'),
    db.q('SELECT COUNT(*)::int AS c FROM posts'),
    db.q('SELECT COUNT(*)::int AS c FROM reels'),
    db.q('SELECT COUNT(*)::int AS c FROM conversations'),
    db.q('SELECT COUNT(*)::int AS c FROM messages'),
    db.q('SELECT COUNT(*)::int AS c FROM listings'),
    db.q('SELECT COUNT(*)::int AS c FROM campaigns'),
    db.q('SELECT COUNT(*)::int AS c FROM users WHERE gold=TRUE'),
    db.q("SELECT COUNT(*)::int AS c FROM gold_requests WHERE status='PENDING_REVIEW'"),
    db.q("SELECT COUNT(*)::int AS c FROM campaigns WHERE status='PENDING_REVIEW'"),
  ]);
  res.json({
    users: u[0].c, posts: p[0].c, reels: r[0].c, conversations: c[0].c, messages: m[0].c,
    listings: l[0].c, campaigns: camp[0].c, gold: g[0].c,
    pendingGold: pg[0].c, pendingAds: pa[0].c,
  });
});

// ---- Users ----
router.get('/users', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM users ORDER BY created_at DESC LIMIT 500');
  res.json({ items: rows.map((u) => db.strip(db.userRow(u, true))) });
});
router.post('/users/:id/ban', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const banned = !rows[0].banned;
  await db.q('UPDATE users SET banned=$1 WHERE id=$2', [banned, req.params.id]);
  await db.auditLog(req.user.username, banned ? 'ban_user' : 'unban_user', rows[0].username);
  res.json({ id: req.params.id, banned });
});
router.delete('/users/:id', gate, async (req, res) => {
  const rows = await db.q('SELECT id, username FROM users WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  await db.q('DELETE FROM users WHERE id=$1', [req.params.id]); // content cascades
  await db.auditLog(req.user.username, 'delete_user', rows[0].username);
  res.json({ ok: true });
});

// ---- Content ----
router.get('/posts', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50');
  const aids = [...new Set(rows.map((p) => p.author_id))];
  const authors = aids.length ? await db.q('SELECT * FROM users WHERE id = ANY($1)', [aids]) : [];
  const byId = Object.fromEntries(authors.map((u) => [u.id, db.strip(db.userRow(u, true))]));
  res.json({ items: rows.map((p) => ({ ...db.postRow(p), author: byId[p.author_id] || null })) });
});
router.delete('/posts/:id', gate, async (req, res) => {
  const del = await db.q('DELETE FROM posts WHERE id=$1 RETURNING id', [req.params.id]);
  if (!del.length) return res.status(404).json({ error: 'not_found' });
  await db.auditLog(req.user.username, 'delete_post', req.params.id);
  res.json({ ok: true });
});
router.post('/posts/:id/boost', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM posts WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const boosted = !rows[0].boosted;
  await db.q('UPDATE posts SET boosted=$1, boosted_at=$2 WHERE id=$3',
    [boosted, boosted ? new Date().toISOString() : null, req.params.id]);
  const a = await db.q('SELECT id FROM users WHERE id=$1', [rows[0].author_id]);
  if (a.length) {
    await db.notify(a[0].id, boosted
      ? { category: 'admin', title: 'إدارة الموقع: تم دعم منشورك', body: 'منشورك عجب الإدارة واتدعم — هيوصل لناس أكتر.' }
      : { category: 'admin', title: 'إدارة الموقع: انتهى الدعم', body: 'اتشال الدعم من منشورك ورجع للترتيب الطبيعي.' });
  }
  await db.auditLog(req.user.username, boosted ? 'boost_post' : 'unboost_post', req.params.id);
  res.json({ id: req.params.id, boosted });
});
router.delete('/reels/:id', gate, async (req, res) => {
  const del = await db.q('DELETE FROM reels WHERE id=$1 RETURNING id', [req.params.id]);
  if (!del.length) return res.status(404).json({ error: 'not_found' });
  await db.auditLog(req.user.username, 'delete_reel', req.params.id);
  res.json({ ok: true });
});

// ---- Gold ----
router.get('/gold-requests', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM gold_requests ORDER BY created_at DESC LIMIT 200');
  const uids = [...new Set(rows.map((r) => r.user_id))];
  const users = uids.length ? await db.q('SELECT * FROM users WHERE id = ANY($1)', [uids]) : [];
  const byId = Object.fromEntries(users.map((u) => [u.id, db.strip(db.userRow(u, true))]));
  res.json({ items: rows.map((r) => ({ ...db.grRow(r), user: byId[r.user_id] || null })) });
});
router.post('/gold-requests/:id/:decision', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM gold_requests WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const r = db.grRow(rows[0]);
  if (req.params.decision === 'approve') {
    r.status = 'APPROVED';
    await db.q('UPDATE gold_requests SET status=$1 WHERE id=$2', ['APPROVED', r.id]);
    await db.q('UPDATE users SET gold=TRUE WHERE id=$1', [r.userId]);
    await db.notify(r.userId, { category: 'gold', title: 'Gold approved', body: `${r.package?.name || 'ZIVV Gold'} is now active on your account.` });
  } else {
    r.status = 'REJECTED';
    await db.q('UPDATE gold_requests SET status=$1 WHERE id=$2', ['REJECTED', r.id]);
    await db.notify(r.userId, { category: 'gold', title: 'Gold request rejected', body: 'Contact support for details.' });
  }
  await db.auditLog(req.user.username, `gold_${req.params.decision}`, r.id);
  res.json(r);
});

// ---- Ads ----
router.get('/ads', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 200');
  const uids = [...new Set(rows.map((c) => c.user_id))];
  const users = uids.length ? await db.q('SELECT * FROM users WHERE id = ANY($1)', [uids]) : [];
  const byId = Object.fromEntries(users.map((u) => [u.id, db.strip(db.userRow(u, true))]));
  res.json({ items: rows.map((c) => ({ ...db.campRow(c), owner: byId[c.user_id] || null })) });
});
router.post('/ads/:id/:decision', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM campaigns WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const c = db.campRow(rows[0]);
  if (req.params.decision === 'approve') {
    c.status = 'PENDING_PAYMENT';
    await db.q('UPDATE campaigns SET status=$1 WHERE id=$2', ['PENDING_PAYMENT', c.id]);
    await db.notify(c.userId, { category: 'ads', title: 'Ad approved — payment next', body: `"${c.title}" passed review. Admin will send the price and payment method.` });
  } else {
    c.status = 'REJECTED';
    await db.q('UPDATE campaigns SET status=$1 WHERE id=$2', ['REJECTED', c.id]);
    await db.notify(c.userId, { category: 'ads', title: 'Ad rejected', body: `"${c.title}" did not pass review.` });
  }
  await db.auditLog(req.user.username, `ad_${req.params.decision}`, c.id);
  res.json(c);
});
router.post('/ads/:id/activate', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM campaigns WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  await db.q('UPDATE campaigns SET status=$1 WHERE id=$2', ['ACTIVE', req.params.id]);
  const c = db.campRow({ ...rows[0], status: 'ACTIVE' });
  await db.notify(c.userId, { category: 'ads', title: 'Ad is live', body: `"${c.title}" is now running.` });
  await db.auditLog(req.user.username, 'ad_activate', c.id);
  res.json(c);
});

// ---- Broadcast / DM as site administration ----
router.post('/notify', gate, async (req, res) => {
  const { to, title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'missing_fields' });
  const fullTitle = `إدارة الموقع: ${title}`;
  if (to === 'all' || !to) {
    const sent = await db.notifyAll({ category: 'admin', title: fullTitle, body });
    await db.auditLog(req.user.username, 'notify_all', title);
    return res.json({ sent });
  }
  const rows = await db.q('SELECT id, username FROM users WHERE LOWER(username)=LOWER($1) OR id=$1', [to]);
  if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
  await db.notify(rows[0].id, { category: 'admin', title: fullTitle, body });
  await db.auditLog(req.user.username, 'notify_user', rows[0].username);
  res.json({ sent: 1 });
});

router.get('/audit', gate, async (req, res) => {
  const rows = await db.q('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100');
  res.json({ items: rows.map(db.auditRow) });
});

router.get('/review-queue', gate, async (req, res) => {
  const [ads, gold] = await Promise.all([
    db.q("SELECT * FROM campaigns WHERE status='PENDING_REVIEW' ORDER BY created_at DESC"),
    db.q("SELECT * FROM gold_requests WHERE status='PENDING_REVIEW' ORDER BY created_at DESC"),
  ]);
  res.json({ ads: ads.map(db.campRow), gold: gold.map(db.grRow), reports: [] });
});

module.exports = router;
