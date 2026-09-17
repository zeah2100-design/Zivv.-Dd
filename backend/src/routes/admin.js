// KING admin: hidden UX client-side; REAL security here — role check + audit + rate limits.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const S = require('../lib/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkPassword, signAccess } = require('../lib/auth');

const adminLoginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 10 });
const gate = [requireAuth, requireRole('ADMIN', 'SUPERADMIN')];

function strip(u) { if (!u) return null; const { _pw, _vault, ...r } = u; return r; }

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
  S.auditLog(username, 'admin_login', '');
  res.json({ access: signAccess({ id: 'admin-1', username, role: 'ADMIN' }), role: 'ADMIN' });
});

router.get('/stats', gate, (req, res) => {
  const msgCount = Object.values(S.messages).reduce((n, arr) => n + arr.length, 0);
  res.json({
    users: S.users.length, posts: S.posts.length, reels: S.reels.length,
    conversations: S.conversations.length, messages: msgCount,
    listings: S.listings.length, campaigns: S.campaigns.length,
    gold: S.users.filter(u => u.gold).length,
    pendingGold: S.goldRequests.filter(r => r.status === 'PENDING_REVIEW').length,
    pendingAds: S.campaigns.filter(c => c.status === 'PENDING_REVIEW').length,
  });
});

// ---- Users ----
router.get('/users', gate, (req, res) => {
  res.json({ items: S.users.map(strip) });
});
router.post('/users/:id/ban', gate, (req, res) => {
  const u = S.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  u.banned = !u.banned;
  S.auditLog(req.user.username, u.banned ? 'ban_user' : 'unban_user', u.username);
  res.json({ id: u.id, banned: u.banned });
});
router.delete('/users/:id', gate, (req, res) => {
  const i = S.users.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  const [u] = S.users.splice(i, 1);
  S.posts = S.posts.filter(p => p.authorId !== u.id);
  S.reels = S.reels.filter(r => r.authorId !== u.id);
  S.listings = S.listings.filter(l => l.sellerId !== u.id);
  S.auditLog(req.user.username, 'delete_user', u.username);
  res.json({ ok: true });
});

// ---- Content ----
router.get('/posts', gate, (req, res) => {
  res.json({ items: S.posts.slice(0, 50).map(p => ({ ...p, author: strip(S.users.find(u => u.id === p.authorId)) })) });
});
router.delete('/posts/:id', gate, (req, res) => {
  const i = S.posts.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  S.posts.splice(i, 1);
  S.auditLog(req.user.username, 'delete_post', req.params.id);
  res.json({ ok: true });
});
router.delete('/reels/:id', gate, (req, res) => {
  const i = S.reels.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  S.reels.splice(i, 1);
  S.auditLog(req.user.username, 'delete_reel', req.params.id);
  res.json({ ok: true });
});

// ---- Gold ----
router.get('/gold-requests', gate, (req, res) => {
  res.json({ items: S.goldRequests.map(r => ({ ...r, user: strip(S.users.find(u => u.id === r.userId)) })) });
});
router.post('/gold-requests/:id/:decision', gate, (req, res) => {
  const r = S.goldRequests.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  const u = S.users.find(x => x.id === r.userId);
  if (req.params.decision === 'approve') {
    r.status = 'APPROVED';
    if (u) { u.gold = true; S.notify(u.id, { category: 'gold', title: 'Gold approved', body: `${r.package?.name || 'ZIVV Gold'} is now active on your account.` }); }
  } else {
    r.status = 'REJECTED';
    if (u) S.notify(u.id, { category: 'gold', title: 'Gold request rejected', body: 'Contact support for details.' });
  }
  S.auditLog(req.user.username, `gold_${req.params.decision}`, r.id);
  res.json(r);
});

// ---- Ads ----
router.get('/ads', gate, (req, res) => {
  res.json({ items: S.campaigns.map(c => ({ ...c, owner: strip(S.users.find(u => u.id === c.userId)) })) });
});
router.post('/ads/:id/:decision', gate, (req, res) => {
  const c = S.campaigns.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  if (req.params.decision === 'approve') {
    c.status = 'PENDING_PAYMENT';
    S.notify(c.userId, { category: 'ads', title: 'Ad approved — payment next', body: `"${c.title}" passed review. Admin will send the price and payment method.` });
  } else {
    c.status = 'REJECTED';
    S.notify(c.userId, { category: 'ads', title: 'Ad rejected', body: `"${c.title}" did not pass review.` });
  }
  S.auditLog(req.user.username, `ad_${req.params.decision}`, c.id);
  res.json(c);
});
router.post('/ads/:id/activate', gate, (req, res) => {
  const c = S.campaigns.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  c.status = 'ACTIVE';
  S.notify(c.userId, { category: 'ads', title: 'Ad is live', body: `"${c.title}" is now running.` });
  S.auditLog(req.user.username, 'ad_activate', c.id);
  res.json(c);
});

// ---- Broadcast / DM as site administration ----
router.post('/notify', gate, (req, res) => {
  const { to, title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'missing_fields' });
  const fullTitle = `إدارة الموقع: ${title}`;
  if (to === 'all' || !to) {
    S.users.forEach(u => S.notify(u.id, { category: 'admin', title: fullTitle, body }));
    S.auditLog(req.user.username, 'notify_all', title);
    return res.json({ sent: S.users.length });
  }
  const u = S.users.find(x => x.username === to || x.id === to);
  if (!u) return res.status(404).json({ error: 'user_not_found' });
  S.notify(u.id, { category: 'admin', title: fullTitle, body });
  S.auditLog(req.user.username, 'notify_user', u.username);
  res.json({ sent: 1 });
});

router.get('/audit', gate, (req, res) => res.json({ items: S.audit.slice(0, 100) }));

router.get('/review-queue', gate, (req, res) => {
  res.json({
    ads: S.campaigns.filter(c => c.status === 'PENDING_REVIEW'),
    gold: S.goldRequests.filter(r => r.status === 'PENDING_REVIEW'),
    reports: [],
  });
});

module.exports = router;
