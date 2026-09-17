const { verifyAccess } = require('../lib/auth');

// Demo-friendly: if no Authorization header, attach demo user u-you (dev only).
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = { id: 'u-you', username: 'you', role: 'USER' };
      return next();
    }
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const p = verifyAccess(token);
    req.user = { id: p.sub, username: p.username, role: p.role };
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
