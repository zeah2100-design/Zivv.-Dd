const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { signAccess, signRefresh, verifyRefresh, hashPassword, checkPassword } = require('../lib/auth');
const S = require('../lib/store');

const loginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 30 });
const registerLimiter = rateLimit({ windowMs: 60 * 60e3, max: 20 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_RE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

function strip(u) { if (!u) return null; const { _pw, _vault, ...r } = u; return r; }

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
  if (S.users.find(u => u.username.toLowerCase() === handle)) return res.status(409).json({ error: 'username_taken' });
  if (S.users.find(u => (u.email || '').toLowerCase() === mail)) return res.status(409).json({ error: 'email_taken' });
  const user = {
    id: 'u-' + S.uuid().slice(0, 8), firstName: fn, lastName: ln, name: `${fn} ${ln}`,
    username: handle, email: mail, age: ageN, bio: '', avatar: null,
    followers: 0, following: 0, verified: false, gold: false, points: 0,
    banned: false, role: 'USER', _pw: await hashPassword(password),
  };
  S.users.push(user);
  res.json({ access: signAccess(user), refresh: signRefresh(user), user: strip(user) });
});

// Login: firstName + lastName + handle + password (all must match).
router.post('/login', loginLimiter, async (req, res) => {
  const { firstName, lastName, username, password } = req.body || {};
  const handle = (username || '').trim().toLowerCase();
  const user = S.users.find(u => u.username.toLowerCase() === handle);
  if (!user) return res.status(401).json({ error: 'bad_credentials' });
  if (user.banned) return res.status(403).json({ error: 'banned' });
  const fnOk = (user.firstName || '').toLowerCase() === (firstName || '').trim().toLowerCase();
  const lnOk = (user.lastName || '').toLowerCase() === (lastName || '').trim().toLowerCase();
  if (!fnOk || !lnOk) return res.status(401).json({ error: 'bad_credentials' });
  if (!(await checkPassword(password || '', user._pw || ''))) return res.status(401).json({ error: 'bad_credentials' });
  res.json({ access: signAccess(user), refresh: signRefresh(user), user: strip(user) });
});

router.post('/refresh', async (req, res) => {
  const { refresh } = req.body || {};
  try {
    const p = verifyRefresh(refresh);
    const user = S.users.find(u => u.id === p.sub);
    if (!user || user.banned) throw new Error('gone');
    res.json({ access: signAccess(user) });
  } catch {
    return res.status(401).json({ error: 'invalid_refresh' });
  }
});

router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  const u = S.users.find(x => x.id === req.user.id);
  if (!u || u.banned) return res.status(401).json({ error: 'gone' });
  res.json({ user: strip(u) });
});

module.exports = router;
