// Draft → Pending Review → Approved/Rejected → Pending Payment → Paid → Active → Completed
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM campaigns WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ items: rows.map(db.campRow) });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, contentRef, budgetCents, durationDays, audience } = req.body || {};
  const id = 'ad' + Date.now();
  const rows = await db.q(
    `INSERT INTO campaigns (id, user_id, title, content_ref, budget_cents, duration_days, audience)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, req.user.id, title || 'Untitled campaign', contentRef || '',
      budgetCents || 50000, durationDays || 7, JSON.stringify(audience || {})]
  );
  const c = db.campRow(rows[0]);
  await db.notify(req.user.id, { category: 'ads', title: 'Ad request received', body: `"${c.title}" is under review. Admin will send the price and payment method.` });
  res.status(201).json(c);
});

router.post('/:id/:action', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM campaigns WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const c = db.campRow(rows[0]);
  const a = req.params.action;
  if (a === 'pause' && c.status === 'ACTIVE') c.status = 'PAUSED';
  else if (a === 'resume' && c.status === 'PAUSED') c.status = 'ACTIVE';
  await db.q('UPDATE campaigns SET status=$1 WHERE id=$2', [c.status, c.id]);
  res.json(c);
});

module.exports = router;
