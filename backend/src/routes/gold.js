// Gold: cash request → admin review + price message → approve • OR •
// instant redeem with 1,000 points (earned: 10k views on one post).
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const REDEEM_COST = 1000;

router.get('/packages', requireAuth, (req, res) => res.json({ items: db.goldPackages }));
router.get('/status', requireAuth, async (req, res) => {
  const [uRows, rRows] = await Promise.all([
    db.q('SELECT gold, points FROM users WHERE id=$1', [req.user.id]),
    db.q('SELECT * FROM gold_requests WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]),
  ]);
  const u = uRows[0];
  res.json({ gold: !!u?.gold, points: u?.points || 0, redeemCost: REDEEM_COST, requests: rRows.map(db.grRow) });
});

router.post('/request', requireAuth, async (req, res) => {
  const uRows = await db.q('SELECT gold FROM users WHERE id=$1', [req.user.id]);
  if (uRows[0]?.gold) return res.status(400).json({ error: 'already_gold' });
  const { packageId } = req.body || {};
  const pkg = db.goldPackages.find((p) => p.id === packageId) || db.goldPackages[0];
  const id = 'gr' + Date.now();
  const rows = await db.q(
    'INSERT INTO gold_requests (id, user_id, package) VALUES ($1,$2,$3) RETURNING *',
    [id, req.user.id, JSON.stringify(pkg)]
  );
  await db.notify(req.user.id, { category: 'gold', title: 'Gold request sent', body: `${pkg.name} — under review. Admin will send the price shortly.` });
  res.status(201).json(db.grRow(rows[0]));
});

router.post('/redeem', requireAuth, async (req, res) => {
  const rows = await db.q(
    `UPDATE users SET points=points-$1, gold=TRUE
     WHERE id=$2 AND gold=FALSE AND points>=$1
     RETURNING gold, points`,
    [REDEEM_COST, req.user.id]
  );
  if (!rows.length) {
    const u = await db.q('SELECT gold, points FROM users WHERE id=$1', [req.user.id]);
    if (!u.length) return res.status(404).json({ error: 'not_found' });
    if (u[0].gold) return res.status(400).json({ error: 'already_gold' });
    return res.status(422).json({ error: 'not_enough_points', need: REDEEM_COST, have: u[0].points || 0 });
  }
  await db.notify(req.user.id, { category: 'gold', title: 'Welcome to ZIVV Gold', body: 'Redeemed with 1,000 points. Enjoy voice AI, agent actions and more.' });
  res.json({ gold: true, points: rows[0].points });
});

module.exports = router;
