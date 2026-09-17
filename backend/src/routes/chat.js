const router = require('express').Router();
const S = require('../lib/store');
const { requireAuth } = require('../middleware/auth');

// Start (or open) a 1:1 conversation with another user.
router.post('/conversations', requireAuth, (req, res) => {
  const { userId } = req.body || {};
  const peer = S.users.find(u => u.id === userId);
  if (!peer || peer.banned || peer.id === req.user.id) return res.status(400).json({ error: 'bad_user' });
  let c = S.conversations.find(x => !x.private && x.members.includes(req.user.id) && x.members.includes(peer.id) && x.members.length === 2);
  if (!c) {
    c = { id: 'c' + Date.now(), title: null, members: [req.user.id, peer.id], lastMessage: '', unread: 0, online: false, typing: false, updatedAt: new Date().toISOString(), private: false };
    S.conversations.unshift(c);
  }
  res.json({ ...c, peer });
});

router.get('/conversations', requireAuth, (req, res) => {
  const items = S.conversations.filter(c => c.members.includes(req.user.id) && !c.private).map(c => ({
    ...c, peer: S.users.find(u => c.members.find(m => m !== req.user.id) === u.id),
  })).filter(c => c.peer && !c.peer.banned);
  res.json({ items });
});

router.get('/conversations/:id/messages', requireAuth, (req, res) => {
  const c = S.conversations.find(x => x.id === req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'not_found' });
  res.json({ items: S.messages[req.params.id] || [] });
});

router.post('/conversations/:id/messages', requireAuth, (req, res) => {
  const c = S.conversations.find(x => x.id === req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'not_found' });
  const { text, kind = 'text', audio = '' } = req.body || {};
  if (!text && !audio) return res.status(400).json({ error: 'empty' });
  if (audio && audio.length > 2.5e6) return res.status(413).json({ error: 'audio_too_large' });
  const msg = { id: 'm' + Date.now(), senderId: req.user.id, kind: audio ? 'audio' : kind, text: text || '', audio: audio || '', createdAt: new Date().toISOString(), state: 'sent' };
  (S.messages[req.params.id] = S.messages[req.params.id] || []).push(msg);
  c.lastMessage = audio ? '🎤 Voice message' : text; c.updatedAt = new Date().toISOString();
  c.unread = (c.unread || 0) + 1;
  req.app.get('io')?.to(req.params.id).emit('message:new', msg);
  res.status(201).json(msg);
});

router.post('/conversations/:id/read', requireAuth, (req, res) => {
  const c = S.conversations.find(x => x.id === req.params.id);
  if (c && c.members.includes(req.user.id)) c.unread = 0;
  res.json({ ok: true });
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

// AI-in-chat: explicit + user-triggered only.
router.post('/ai-assist', requireAuth, (req, res) => {
  const { mode, text } = req.body || {};
  const out = {
    reply: ['Sounds great!', 'Let me check and get back to you.', 'Haha exactly'],
    translate: `[EN] ${text}`,
    summary: `Summary: ${(text || '').slice(0, 120)}…`,
    improve: (text || '') + ' ✨',
  }[mode] || 'OK';
  res.json({ result: out });
});

module.exports = router;
