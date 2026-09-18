const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { verifyAccess } = require('../lib/auth');

// Vault gate for private chats: short-lived token from POST /chat/vault/unlock.
function vaultUid(req) {
  try {
    const t = req.headers['x-vault-token'] || '';
    const p = verifyAccess(t);
    if (typeof p.sub === 'string' && p.sub.endsWith(':vault') && p.sub.slice(0, -6) === req.user.id) return req.user.id;
  } catch {}
  return null;
}
async function peerMap(ids) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return {};
  const peers = await db.q('SELECT * FROM users WHERE id = ANY($1)', [uniq]);
  return Object.fromEntries(peers.map((u) => [u.id, db.strip(db.userRow(u, true))]));
}

// Start (or open) a 1:1 conversation with another user.
router.post('/conversations', requireAuth, async (req, res) => {
  const { userId } = req.body || {};
  const pRows = await db.q('SELECT * FROM users WHERE id=$1', [userId]);
  const peer = db.userRow(pRows[0]);
  if (!peer || peer.banned || peer.id === req.user.id) return res.status(400).json({ error: 'bad_user' });
  const [a, b] = [req.user.id, peer.id].sort();
  let rows = await db.q(
    'SELECT * FROM conversations WHERE a_id=$1 AND b_id=$2 AND is_private=FALSE', [a, b]
  );
  if (!rows.length) {
    const id = 'c' + Date.now();
    rows = await db.q(
      `INSERT INTO conversations (id, a_id, b_id) VALUES ($1,$2,$3)
       ON CONFLICT (a_id, b_id, is_private) DO NOTHING RETURNING *`,
      [id, a, b]
    );
    if (!rows.length) rows = await db.q('SELECT * FROM conversations WHERE a_id=$1 AND b_id=$2', [a, b]);
  }
  res.json({ ...db.convoRow(rows[0]), peer: db.strip(peer) });
});

router.get('/conversations', requireAuth, async (req, res) => {
  const rows = await db.q(
    'SELECT * FROM conversations WHERE (a_id=$1 OR b_id=$1) AND is_private=FALSE ORDER BY updated_at DESC',
    [req.user.id]
  );
  const peerIds = [...new Set(rows.map((c) => (c.a_id === req.user.id ? c.b_id : c.a_id)))];
  const peers = peerIds.length ? await db.q('SELECT * FROM users WHERE id = ANY($1)', [peerIds]) : [];
  const byId = Object.fromEntries(peers.map((u) => [u.id, db.userRow(u)]));
  const items = rows
    .map((c) => ({ ...db.convoRow(c), peer: byId[c.a_id === req.user.id ? c.b_id : c.a_id] || null }))
    .filter((c) => c.peer && !c.peer.banned)
    .map((c) => ({ ...c, peer: db.strip(c.peer) }));
  res.json({ items });
});

router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const c = await db.q('SELECT * FROM conversations WHERE id=$1', [req.params.id]);
  if (!c.length || (c[0].a_id !== req.user.id && c[0].b_id !== req.user.id)) return res.status(404).json({ error: 'not_found' });
  const rows = await db.q('SELECT * FROM messages WHERE conv_id=$1 ORDER BY created_at ASC LIMIT 100', [req.params.id]);
  res.json({ items: rows.map((r) => db.msgRow(r, false)) });
});

router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  const c = await db.q('SELECT * FROM conversations WHERE id=$1', [req.params.id]);
  if (!c.length || (c[0].a_id !== req.user.id && c[0].b_id !== req.user.id)) return res.status(404).json({ error: 'not_found' });
  const { text, kind = 'text', audio = '', image = '' } = req.body || {};
  if (!text && !audio && !image) return res.status(400).json({ error: 'empty' });
  if (audio && audio.length > 4.2e6) return res.status(413).json({ error: 'audio_too_large' });
  if (image && image.length > 4.2e6) return res.status(413).json({ error: 'image_too_large' });
  const id = 'm' + Date.now();
  const rows = await db.q(
    'INSERT INTO messages (id, conv_id, sender_id, kind, text, audio, image) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [id, req.params.id, req.user.id, audio ? 'audio' : image ? 'image' : kind, text || '', audio || '', image || '']
  );
  const msg = db.msgRow(rows[0]);
  const label = audio ? '🎤 Voice message' : image ? '📷 Photo' : (text || '');
  await db.q('UPDATE conversations SET last_message=$1, unread=unread+1, updated_at=now() WHERE id=$2', [label, req.params.id]);
  req.app.get('io')?.to(req.params.id).emit('message:new', msg);
  res.status(201).json(msg);
});

router.get('/messages/:mid/image', requireAuth, async (req, res) => {
  const rows = await db.q(
    `SELECT m.image FROM messages m JOIN conversations c ON c.id=m.conv_id
     WHERE m.id=$1 AND (c.a_id=$2 OR c.b_id=$2)`, [req.params.mid, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ image: rows[0].image || '' });
});

router.get('/messages/:mid/audio', requireAuth, async (req, res) => {
  const rows = await db.q(
    `SELECT m.audio FROM messages m JOIN conversations c ON c.id=m.conv_id
     WHERE m.id=$1 AND (c.a_id=$2 OR c.b_id=$2)`, [req.params.mid, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ audio: rows[0].audio || '' });
});

router.post('/conversations/:id/read', requireAuth, async (req, res) => {
  await db.q('UPDATE conversations SET unread=0 WHERE id=$1 AND (a_id=$2 OR b_id=$2)', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// --- Private (locked) chats: same API, gated by vault unlock token ---
router.post('/vault/setup', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'weak_password' });
  const { hashPassword } = require('../lib/auth');
  await db.q('UPDATE users SET vault=$1 WHERE id=$2', [await hashPassword(password), req.user.id]);
  res.json({ ok: true });
});

router.post('/vault/unlock', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const rows = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const u = db.userRow(rows[0], true);
  if (!u || !u._vault) return res.status(404).json({ error: 'no_vault' });
  if (u._lockoutUntil && Date.now() < u._lockoutUntil) return res.status(429).json({ error: 'locked_out', retryAfter: 60 });
  const { checkPassword } = require('../lib/auth');
  const ok = await checkPassword(password || '', u._vault);
  if (!ok) {
    const attempts = (u._attempts || 0) + 1;
    if (attempts >= 5) {
      await db.q('UPDATE users SET attempts=0, lockout_until=$1 WHERE id=$2', [Date.now() + 5 * 60e3, u.id]);
    } else {
      await db.q('UPDATE users SET attempts=$1 WHERE id=$2', [attempts, u.id]);
    }
    return res.status(401).json({ error: 'bad_password' });
  }
  await db.q('UPDATE users SET attempts=0 WHERE id=$1', [u.id]);
  const { signAccess } = require('../lib/auth');
  res.json({ vaultToken: signAccess({ id: u.id + ':vault', username: u.username }), expiresIn: 300 });
});

// --- Private (vault-gated) conversations: fully real, same table, is_private=TRUE ---
router.post('/private/conversations', requireAuth, async (req, res) => {
  if (!vaultUid(req)) return res.status(403).json({ error: 'vault_locked' });
  const { userId } = req.body || {};
  const pRows = await db.q('SELECT * FROM users WHERE id=$1', [userId]);
  const peer = db.strip(db.userRow(pRows[0], true));
  if (!peer || peer.banned || peer.id === req.user.id) return res.status(400).json({ error: 'bad_user' });
  const [a, b] = [req.user.id, peer.id].sort();
  let rows = await db.q('SELECT * FROM conversations WHERE a_id=$1 AND b_id=$2 AND is_private=TRUE', [a, b]);
  if (!rows.length) {
    const id = 'c' + Date.now();
    rows = await db.q(
      `INSERT INTO conversations (id, a_id, b_id, is_private) VALUES ($1,$2,$3,TRUE)
       ON CONFLICT (a_id, b_id, is_private) DO NOTHING RETURNING *`, [id, a, b]);
    if (!rows.length) rows = await db.q('SELECT * FROM conversations WHERE a_id=$1 AND b_id=$2 AND is_private=TRUE', [a, b]);
  }
  res.json({ ...db.convoRow(rows[0]), peer });
});

router.get('/private/conversations', requireAuth, async (req, res) => {
  if (!vaultUid(req)) return res.status(403).json({ error: 'vault_locked' });
  const rows = await db.q(
    'SELECT * FROM conversations WHERE (a_id=$1 OR b_id=$1) AND is_private=TRUE ORDER BY updated_at DESC', [req.user.id]);
  const byId = await peerMap(rows.map((c) => (c.a_id === req.user.id ? c.b_id : c.a_id)));
  const items = rows
    .map((c) => ({ ...db.convoRow(c), peer: byId[c.a_id === req.user.id ? c.b_id : c.a_id] || null }))
    .filter((c) => c.peer && !c.peer.banned);
  res.json({ items });
});

router.get('/private/conversations/:id/messages', requireAuth, async (req, res) => {
  if (!vaultUid(req)) return res.status(403).json({ error: 'vault_locked' });
  const c = await db.q('SELECT * FROM conversations WHERE id=$1 AND is_private=TRUE', [req.params.id]);
  if (!c.length || (c[0].a_id !== req.user.id && c[0].b_id !== req.user.id)) return res.status(404).json({ error: 'not_found' });
  const rows = await db.q('SELECT * FROM messages WHERE conv_id=$1 ORDER BY created_at ASC LIMIT 100', [req.params.id]);
  res.json({ items: rows.map((r) => db.msgRow(r, false)) });
});

router.post('/private/conversations/:id/messages', requireAuth, async (req, res) => {
  if (!vaultUid(req)) return res.status(403).json({ error: 'vault_locked' });
  const c = await db.q('SELECT * FROM conversations WHERE id=$1 AND is_private=TRUE', [req.params.id]);
  if (!c.length || (c[0].a_id !== req.user.id && c[0].b_id !== req.user.id)) return res.status(404).json({ error: 'not_found' });
  const { text, kind = 'text', audio = '', image = '' } = req.body || {};
  if (!text && !audio && !image) return res.status(400).json({ error: 'empty' });
  if (audio && audio.length > 4.2e6) return res.status(413).json({ error: 'audio_too_large' });
  if (image && image.length > 4.2e6) return res.status(413).json({ error: 'image_too_large' });
  const id = 'm' + Date.now();
  const rows = await db.q(
    'INSERT INTO messages (id, conv_id, sender_id, kind, text, audio, image) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [id, req.params.id, req.user.id, audio ? 'audio' : image ? 'image' : kind, text || '', audio || '', image || '']
  );
  const label = audio ? '🎤 Voice message' : image ? '📷 Photo' : (text || '');
  await db.q('UPDATE conversations SET last_message=$1, unread=unread+1, updated_at=now() WHERE id=$2', [label, req.params.id]);
  res.status(201).json(db.msgRow(rows[0]));
});

router.post('/private/conversations/:id/read', requireAuth, async (req, res) => {
  if (!vaultUid(req)) return res.status(403).json({ error: 'vault_locked' });
  await db.q('UPDATE conversations SET unread=0 WHERE id=$1 AND is_private=TRUE AND (a_id=$2 OR b_id=$2)', [req.params.id, req.user.id]);
  res.json({ ok: true });
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
