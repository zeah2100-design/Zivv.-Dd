// LISTING-ONLY marketplace. ZIVV never sells/collects/ships/guarantees.
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

async function withSellers(rows, withImage = true) {
  const sids = [...new Set(rows.map((l) => l.seller_id))];
  const sellers = sids.length ? await db.q('SELECT * FROM users WHERE id = ANY($1)', [sids]) : [];
  const byId = Object.fromEntries(sellers.map((u) => [u.id, db.stripPublic(db.userRow(u, true))]));
  return rows.map((l) => {
    const o = db.listingRow(l, withImage);
    return { ...o, phone: o.phonePublic ? o.phone : '', seller: byId[o.sellerId] || null };
  });
}

router.get('/', requireAuth, async (req, res) => {
  const { q, category, maxPrice } = req.query;
  const conds = [], vals = [];
  if (q) { vals.push(`%${q.toLowerCase()}%`); conds.push(`(LOWER(title) LIKE $${vals.length} OR LOWER(description) LIKE $${vals.length})`); }
  if (category) { vals.push(category); conds.push(`category=$${vals.length}`); }
  if (maxPrice) { vals.push(parseInt(maxPrice, 10)); conds.push(`price_cents<=$${vals.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db.q(`SELECT * FROM listings ${where} ORDER BY created_at DESC LIMIT 30`, vals);
  res.json({ items: await withSellers(rows, false), categories: ['Phones', 'Sports', 'Cars', 'Fashion', 'Home', 'Electronics'] });
});

router.get('/:id', requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM listings WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const [item] = await withSellers(rows);
  res.json(item);
});

router.post('/', requireAuth, async (req, res) => {
  const { title, description, priceCents, category, condition, phone, phonePublic, aiDeclared, image } = req.body || {};
  if (image && image.length > 4.4e6) return res.status(413).json({ error: 'media_too_large' });
  if (!title || !priceCents) return res.status(400).json({ error: 'missing_fields' });
  // Policy: AI-fabricated "genuine product" listings are rejected.
  if (aiDeclared === 'fabricated') return res.status(422).json({ error: 'ai_fabricated_listing_blocked' });
  const id = 'm' + Date.now();
  const rows = await db.q(
    `INSERT INTO listings (id, seller_id, title, description, price_cents, category, condition, phone, phone_public, image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, req.user.id, title, description || '', priceCents, category || 'Other', condition || 'used',
      phone || '', !!phonePublic, image || '']
  );
  res.status(201).json(db.listingRow(rows[0]));
});

router.post('/:id/report', requireAuth, (req, res) => res.json({ ok: true, message: 'Report received. Our team will review.' }));

module.exports = router;
