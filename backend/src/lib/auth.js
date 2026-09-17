const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev-only-refresh-change-me';

function signAccess(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role || 'USER' }, JWT_SECRET, { expiresIn: '30m' });
}
function signRefresh(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '30d' });
}
function verifyAccess(token) {
  return jwt.verify(token, JWT_SECRET);
}
async function hashPassword(pw) { return bcrypt.hash(pw, 12); }
async function checkPassword(pw, hash) { return bcrypt.compare(pw, hash); }

module.exports = { signAccess, signRefresh, verifyAccess, hashPassword, checkPassword };
