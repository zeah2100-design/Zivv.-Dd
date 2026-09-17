const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { signAccess, signRefresh, hashPassword, checkPassword } = require('../lib/auth');
const S = require('../lib/store');

const loginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 30 });

router.post('/register', async (req, res) => {
  const { name, username, email, password } = req.body || {};
  if (!name || !username || !password) return res.status(400).json({ error: 'missing_fields' });
  if (S.users.find(u => u.username === username)) return res.status(409).json({ error: 'username_taken' });
  const user = { id: 'u-' + S.uuid().slice(0, 8), name, username, bio: '', followers: 0, following: 0, verified: false, gold: false, _pw: await hashPassword(password), email };
  S.users.push(user);
  const access = signAccess(user), refresh = signRefresh(user);
  res.json({ access, refresh, user: strip(user) });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const user = S.users.find(u => u.username === username) || S.users.find(u => u.id === 'u-you');
  if (user._pw && !(await checkPassword(password || '', user._pw))) return res.status(401).json({ error: 'bad_credentials' });
  res.json({ access: signAccess(user), refresh: signRefresh(user), user: strip(user) });
});

router.post('/refresh', (req, res) => {
  const user = S.users.find(u => u.id === 'u-you');
  res.json({ access: signAccess(user) });
});

router.get('/me', (req, res) => res.json({ user: strip(S.users.find(u => u.id === 'u-you')) }));

function strip(u) { const { _pw, ...r } = u; return r; }
module.exports = router;
