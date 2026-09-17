// Gold: cash request → admin review + price message → approve • OR •
// instant redeem with 1,000 points (earned: 10k views on one post).
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

const REDEEM_COST = 1000;

router.get('/packages', requireAuth, (req, res) => res.json({ items: S.goldPackages }));
router.get('/status', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.user.id);
  const mine = S.goldRequests.filter(r => r.userId === req.user.id);
  res.json({ gold: !!u?.gold, points: u?.points || 0, redeemCost: REDEEM_COST, requests: mine });
});

router.post('/request', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.user.id);
  if (u?.gold) return res.status(400).json({ error: 'already_gold' });
  const { packageId } = req.body || {};
  const pkg = S.goldPackages.find(p => p.id === packageId) || S.goldPackages[0];
  const r = { id: 'gr' + Date.now(), userId: req.user.id, package: pkg, status: 'PENDING_REVIEW', createdAt: new Date().toISOString() };
  S.goldRequests.unshift(r);
  S.notify(req.user.id, { category: 'gold', title: 'Gold request sent', body: `${pkg.name} — under review. Admin will send the price shortly.` });
  res.status(201).json(r);
});

router.post('/redeem', requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  if (u.gold) return res.status(400).json({ error: 'already_gold' });
  if ((u.points || 0) < REDEEM_COST) return res.status(422).json({ error: 'not_enough_points', need: REDEEM_COST, have: u.points || 0 });
  u.points -= REDEEM_COST;
  u.gold = true;
  S.notify(u.id, { category: 'gold', title: 'Welcome to ZIVV Gold', body: 'Redeemed with 1,000 points. Enjoy voice AI, agent actions and more.' });
  res.json({ gold: true, points: u.points });
});

module.exports = router;
