// LISTING-ONLY marketplace. ZIVV never sells/collects/ships/guarantees.
const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

function strip(u) { if (!u) return null; const { _pw, _vault, email, ...r } = u; return r; }

router.get('/', requireAuth, (req, res) => {
  const { q, category, maxPrice } = req.query;
  let items = S.listings.map(l => ({ ...l, phone: l.phonePublic ? l.phone : '', seller: strip(S.users.find(u => u.id === l.sellerId)) }));
  if (q) items = items.filter(l => (l.title + l.description).toLowerCase().includes(q.toLowerCase()));
  if (category) items = items.filter(l => l.category === category);
  if (maxPrice) items = items.filter(l => l.priceCents <= parseInt(maxPrice, 10));
  res.json({ items, categories: ['Phones', 'Sports', 'Cars', 'Fashion', 'Home', 'Electronics'] });
});

router.get('/:id', requireAuth, (req, res) => {
  const l = S.listings.find(x => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'not_found' });
  res.json({ ...l, phone: l.phonePublic ? l.phone : '', seller: strip(S.users.find(u => u.id === l.sellerId)) });
});

router.post('/', requireAuth, (req, res) => {
  const { title, description, priceCents, category, condition, phone, phonePublic, aiDeclared } = req.body || {};
  if (!title || !priceCents) return res.status(400).json({ error: 'missing_fields' });
  // Policy: AI-fabricated "genuine product" listings are rejected.
  if (aiDeclared === 'fabricated') return res.status(422).json({ error: 'ai_fabricated_listing_blocked' });
  const l = { id: 'm' + Date.now(), sellerId: req.user.id, title, description: description || '',
    priceCents, currency: 'EGP', category: category || 'Other', condition: condition || 'used',
    phone: phone || '', phonePublic: !!phonePublic, status: 'available', createdAt: new Date().toISOString() };
  S.listings.unshift(l);
  res.status(201).json(l);
});

router.post('/:id/report', requireAuth, (req, res) => res.json({ ok: true, message: 'Report received. Our team will review.' }));

module.exports = router;
