// Gold: request → admin approve/reject → pending payment → verified → active.
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const requests = [];

router.get('/packages', requireAuth, (req, res) => res.json({ items: S.goldPackages }));
router.get('/status', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.user.id);
  const mine = requests.filter(r => r.userId === req.user.id);
  res.json({ gold: !!u.gold, requests: mine });
});

router.post('/request', requireAuth, (req, res) => {
  const { packageId } = req.body || {};
  const pkg = S.goldPackages.find(p => p.id === packageId) || S.goldPackages[0];
  const r = { id: 'gr' + Date.now(), userId: req.user.id, package: pkg, status: 'PENDING_REVIEW', createdAt: new Date().toISOString() };
  requests.unshift(r);
  S.notifications.unshift({ id: 'n' + Date.now(), category: 'system', title: 'Gold request sent', body: `${pkg.name} — under review`, read: false, createdAt: new Date().toISOString() });
  res.status(201).json(r);
});

module.exports = router;
