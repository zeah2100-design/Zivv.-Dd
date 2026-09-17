const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const mine = S.notifications.filter(n => !n.userId || n.userId === req.user.id);
  const tab = req.query.tab || 'all';
  const items = tab === 'all' ? mine : mine.filter(n => n.category === tab);
  res.json({ items, unread: mine.filter(n => !n.read).length });
});
router.post('/read-all', requireAuth, (req, res) => {
  S.notifications.forEach(n => { if (!n.userId || n.userId === req.user.id) n.read = true; });
  res.json({ ok: true });
});
module.exports = router;
