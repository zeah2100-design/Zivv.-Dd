const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const tab = req.query.tab || 'all';
  const items = tab === 'all' ? S.notifications : S.notifications.filter(n => n.category === tab);
  res.json({ items, unread: S.notifications.filter(n => !n.read).length });
});
router.post('/read-all', requireAuth, (req, res) => {
  S.notifications.forEach(n => (n.read = true));
  res.json({ ok: true });
});
module.exports = router;
