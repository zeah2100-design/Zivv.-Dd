const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { signAccess, signRefresh, verifyRefresh, hashPassword, checkPassword } = require('../lib/auth');
const db = require('../lib/db');

const loginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 30 });
const registerLimiter = rateLimit({ windowMs: 60 * 60e3, max: 20 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_RE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

// Register: firstName + lastName + age + email + password + confirm + handle.
router.post('/register', registerLimiter, async (req, res) => {
  const { firstName, lastName, age, email, password, confirm, username } = req.body || {};
  const fn = (firstName || '').trim(), ln = (lastName || '').trim();
  const handle = (username || '').trim().toLowerCase();
  const mail = (email || '').trim().toLowerCase();
  const ageN = parseInt(age, 10);
  if (!fn || !ln || !mail || !password || !handle) return res.status(400).json({ error: 'missing_fields' });
  if (!Number.isFinite(ageN) || ageN < 13 || ageN > 120) return res.status(400).json({ error: 'bad_age' });
  if (!EMAIL_RE.test(mail)) return res.status(400).json({ error: 'bad_email' });
  if (String(password).length < 6) return res.status(400).json({ error: 'weak_password' });
  if (password !== confirm) return res.status(400).json({ error: 'password_mismatch' });
  if (!HANDLE_RE.test(handle)) return res.status(400).json({ error: 'bad_handle' });
  if ((await db.q('SELECT id FROM users WHERE username=$1', [handle])).length) return res.status(409).json({ error: 'username_taken' });
  if ((await db.q('SELECT id FROM users WHERE email=$1', [mail])).length) return res.status(409).json({ error: 'email_taken' });
  const id = 'u-' + db.uuid().slice(0, 8);
  const pw = await hashPassword(password);
  try {
    const rows = await db.q(
      `INSERT INTO users (id, first_name, last_name, name, username, email, age, pw_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, fn, ln, `${fn} ${ln}`, handle, mail, ageN, pw]
    );
    const user = db.userRow(rows[0], true);
    res.json({ access: signAccess(user), refresh: signRefresh(user), user: db.strip(user) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'conflict' });
    throw e;
  }
});

// Login: firstName + lastName + handle + password (all must match).
router.post('/login', loginLimiter, async (req, res) => {
  const { firstName, lastName, username, password } = req.body || {};
  const handle = (username || '').trim().toLowerCase();
  const rows = await db.q('SELECT * FROM users WHERE username=$1', [handle]);
  const user = db.userRow(rows[0], true);
  if (!user) return res.status(401).json({ error: 'bad_credentials' });
  if (user.banned) return res.status(403).json({ error: 'banned' });
  const fnOk = (user.firstName || '').toLowerCase() === (firstName || '').trim().toLowerCase();
  const lnOk = (user.lastName || '').toLowerCase() === (lastName || '').trim().toLowerCase();
  if (!fnOk || !lnOk) return res.status(401).json({ error: 'bad_credentials' });
  if (!(await checkPassword(password || '', user._pw || ''))) return res.status(401).json({ error: 'bad_credentials' });
  res.json({ access: signAccess(user), refresh: signRefresh(user), user: db.strip(user) });
});

router.post('/refresh', async (req, res) => {
  const { refresh } = req.body || {};
  try {
    const p = verifyRefresh(refresh);
    const rows = await db.q('SELECT * FROM users WHERE id=$1', [p.sub]);
    const user = db.userRow(rows[0]);
    if (!user || user.banned) throw new Error('gone');
    res.json({ access: signAccess(user) });
  } catch {
    return res.status(401).json({ error: 'invalid_refresh' });
  }
});

router.get('/me', require('../middleware/auth').requireAuth, async (req, res) => {
  const rows = await db.q('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const u = db.userRow(rows[0]);
  if (!u || u.banned) return res.status(401).json({ error: 'gone' });
  res.json({ user: db.strip(u) });
});

module.exports = router;
