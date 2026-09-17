const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

router.get('/conversations', requireAuth, (req, res) => {
  const items = S.conversations.filter(c => c.members.includes(req.user.id) && !c.private).map(c => ({
    ...c, peer: S.users.find(u => c.members.find(m => m !== req.user.id) === u.id),
  }));
  res.json({ items });
});

router.get('/conversations/:id/messages', requireAuth, (req, res) => {
  res.json({ items: S.messages[req.params.id] || [] });
});

router.post('/conversations/:id/messages', requireAuth, (req, res) => {
  const { text, kind = 'text' } = req.body || {};
  if (!text) return res.status(400).json({ error: 'empty' });
  const msg = { id: 'm' + Date.now(), senderId: req.user.id, kind, text, createdAt: new Date().toISOString(), state: 'sent' };
  (S.messages[req.params.id] = S.messages[req.params.id] || []).push(msg);
  const c = S.conversations.find(x => x.id === req.params.id);
  if (c) { c.lastMessage = text; c.updatedAt = new Date().toISOString(); }
  // realtime broadcast via socket (attached on req.app)
  req.app.get('io')?.to(req.params.id).emit('message:new', msg);
  res.status(201).json(msg);
});

// --- Private (locked) chats: same API, gated by vault unlock token ---
router.post('/vault/setup', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'weak_password' });
  const { hashPassword } = require('../lib/auth');
  const u = S.users.find(x => x.id === req.user.id);
  u._vault = await hashPassword(password);
  res.json({ ok: true });
});

router.post('/vault/unlock', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const u = S.users.find(x => x.id === req.user.id);
  if (!u._vault) return res.status(404).json({ error: 'no_vault' });
  if (u._lockoutUntil && Date.now() < u._lockoutUntil) return res.status(429).json({ error: 'locked_out', retryAfter: 60 });
  const { checkPassword } = require('../lib/auth');
  const ok = await checkPassword(password || '', u._vault);
  if (!ok) {
    u._attempts = (u._attempts || 0) + 1;
    if (u._attempts >= 5) { u._lockoutUntil = Date.now() + 5 * 60e3; u._attempts = 0; }
    return res.status(401).json({ error: 'bad_password' });
  }
  u._attempts = 0;
  const { signAccess } = require('../lib/auth');
  res.json({ vaultToken: signAccess({ id: u.id + ':vault', username: u.username }), expiresIn: 300 });
});

// AI-in-chat: explicit + user-triggered only (never silent on E2EE content).
router.post('/ai-assist', requireAuth, (req, res) => {
  const { mode, text } = req.body || {};
  const out = {
    reply: ['Sounds great! 👍', 'Let me check and get back to you.', 'Haha exactly 😄'],
    translate: `[EN] ${text}`,
    summary: `Summary: ${(text || '').slice(0, 120)}…`,
    improve: (text || '') + ' ✨',
  }[mode] || 'OK';
  res.json({ result: out });
});

module.exports = router;
