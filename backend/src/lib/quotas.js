// AI usage quotas — server-side, per user. Gold members get far higher limits.
// Every paid model call spends the owner's provider wallet, so quotas are also spend control.
// Adjust numbers here anytime (no client changes needed).
const db = require('./db');

const LIMITS = {
  chat: { normal: { n: 40, per: 'day' }, gold: { n: 500, per: 'day' } },
  vision: { normal: { n: 10, per: 'day' }, gold: { n: 100, per: 'day' } },
  image: { normal: { n: 3, per: 'day' }, gold: { n: 25, per: 'day' } },
  video: { normal: { n: 1, per: 'week' }, gold: { n: 3, per: 'day' } },
};

function dayKey(d = new Date()) {
  return 'd:' + d.toISOString().slice(0, 10);
}
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `w:${t.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}
const keyFor = (per) => (per === 'week' ? weekKey() : dayKey());

async function used(userId, kind, per) {
  const rows = await db.q(
    'SELECT count FROM ai_usage WHERE user_id=$1 AND kind=$2 AND window=$3',
    [userId, kind, keyFor(per)]
  );
  return rows.length ? Number(rows[0].count) : 0;
}

async function check(userId, kind, isGold) {
  const lim = LIMITS[kind][isGold ? 'gold' : 'normal'];
  const u = await used(userId, kind, lim.per);
  return { allowed: u < lim.n, used: u, limit: lim.n, per: lim.per };
}

// Consume AFTER the provider accepts the work (never on validation/billing failures).
async function consume(userId, kind, isGold) {
  const lim = LIMITS[kind][isGold ? 'gold' : 'normal'];
  await db.q(
    `INSERT INTO ai_usage (user_id, kind, window, count) VALUES ($1,$2,$3,1)
     ON CONFLICT (user_id, kind, window) DO UPDATE SET count = ai_usage.count + 1`,
    [userId, kind, keyFor(lim.per)]
  );
}

async function summary(userId, isGold) {
  const out = {};
  for (const kind of Object.keys(LIMITS)) {
    const c = await check(userId, kind, isGold);
    out[kind] = { used: c.used, limit: c.limit, per: c.per };
  }
  return out;
}

module.exports = { LIMITS, check, consume, summary };
