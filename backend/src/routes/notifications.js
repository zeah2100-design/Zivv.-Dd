const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const tab = req.query.tab || 'all';
  const rows = await db.q(
    'SELECT * FROM notifications WHERE user_id IS NULL OR user_id=$1 ORDER BY created_at DESC LIMIT 200',
    [req.user.id]
  );
  const mine = rows.map(db.notifRow);
  const items = tab === 'all' ? mine : mine.filter((n) => n.category === tab);
  res.json({ items, unread: mine.filter((n) => !n.read).length });
});
router.post('/read-all', requireAuth, async (req, res) => {
  await db.q('UPDATE notifications SET read=TRUE WHERE user_id IS NULL OR user_id=$1', [req.user.id]);
  res.json({ ok: true });
});
module.exports = router;
