const { verifyAccess } = require('../lib/auth');

// No demo bypass: every request needs a valid Bearer access token.
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = verifyAccess(token);
    req.user = { id: p.sub, username: p.username, role: p.role || 'USER' };
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole };
