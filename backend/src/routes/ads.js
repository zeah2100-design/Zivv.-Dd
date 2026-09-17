// Draft → Pending Review → Approved/Rejected → Pending Payment → Paid → Active → Completed
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  res.json({ items: S.campaigns.filter(c => c.userId === req.user.id) });
});

router.post('/', requireAuth, (req, res) => {
  const { title, contentRef, budgetCents, durationDays, audience } = req.body || {};
  const c = { id: 'ad' + Date.now(), userId: req.user.id, title: title || 'Untitled campaign', contentRef: contentRef || '',
    budgetCents: budgetCents || 50000, durationDays: durationDays || 7, audience: audience || {},
    status: 'PENDING_REVIEW', impressions: 0, clicks: 0, createdAt: new Date().toISOString() };
  S.campaigns.unshift(c);
  S.notify(req.user.id, { category: 'ads', title: 'Ad request received', body: `"${c.title}" is under review. Admin will send the price and payment method.` });
  res.status(201).json(c);
});

router.post('/:id/:action', requireAuth, (req, res) => {
  const c = S.campaigns.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  const a = req.params.action;
  if (a === 'pause' && c.status === 'ACTIVE') c.status = 'PAUSED';
  else if (a === 'resume' && c.status === 'PAUSED') c.status = 'ACTIVE';
  res.json(c);
});

module.exports = router;
