const { verifyAccess } = require('../lib/auth');
const db = require('../lib/db');
const seenAt = new Map(); // userId -> last touch (per instance, throttles writes)

// No demo bypass: every request needs a valid Bearer access token.
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = verifyAccess(token);
    req.user = { id: p.sub, username: p.username, role: p.role || 'USER' };
    try {
      const last = seenAt.get(p.sub) || 0;
      if (Date.now() - last > 60000) { seenAt.set(p.sub, Date.now()); db.q('UPDATE users SET last_seen=now() WHERE id=$1', [p.sub]).catch(() => {}); }
    } catch {}
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
