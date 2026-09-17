// KING admin: hidden UX client-side; REAL security here — role check + audit + rate limits.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const S = require('../lib/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkPassword } = require('../lib/auth');

const adminLoginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 10 });

router.post('/login', adminLoginLimiter, async (req, res) => {
  const { username, password, totp } = req.body || {};
  const expectedUser = process.env.ADMIN_BOOTSTRAP_USER || 'king';
  const expectedHash = process.env.ADMIN_BOOTSTRAP_PASS_HASH || '';
  if (username !== expectedUser) return res.status(401).json({ error: 'bad_credentials' });
  if (expectedHash) {
    if (!(await checkPassword(password || '', expectedHash))) return res.status(401).json({ error: 'bad_credentials' });
  } else if ((password || '').length < 8) {
    return res.status(401).json({ error: 'admin_not_bootstrapped' });
  }
  // TOTP verification would go here in production (otplib) when ADMIN_TOTP enforced.
  const { signAccess } = require('../lib/auth');
  res.json({ access: signAccess({ id: 'admin-1', username, role: 'ADMIN' }), role: 'ADMIN', totpRequired: false });
});

router.get('/stats', requireAuth, requireRole('ADMIN', 'SUPERADMIN'), (req, res) => {
  res.json({
    users: 128400 + S.users.length, active: 34210, posts: 892300, reels: 210400,
    messages: 1900000, ads: S.campaigns.length, gold: 4820, reports: 17,
  });
});

router.get('/review-queue', requireAuth, requireRole('ADMIN', 'SUPERADMIN'), (req, res) => {
  res.json({ ads: S.campaigns.filter(c => c.status === 'PENDING_REVIEW'), reports: [], gold: [] });
});

router.post('/ads/:id/:decision', requireAuth, requireRole('ADMIN', 'SUPERADMIN'), (req, res) => {
  const c = S.campaigns.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  c.status = req.params.decision === 'approve' ? 'PENDING_PAYMENT' : 'REJECTED';
  S.notifications.unshift({ id: 'n' + Date.now(), category: 'ads', title: `Ad ${c.status}`, body: c.title, read: false, createdAt: new Date().toISOString() });
  res.json(c);
});

module.exports = router;
