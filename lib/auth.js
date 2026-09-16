const bcrypt = require("bcryptjs");
const crypto = require("crypto");

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  // Support old plain text passwords for migration
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
    return String(password) === String(hash);
  }
  return bcrypt.compare(password, hash);
}

function generateId(prefix = "") {
  return prefix + Date.now().toString(36) + "_" + crypto.randomBytes(4).toString("hex");
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, password_hash, ...safe } = user;
  return safe;
}

function kingSecret() { return String(process.env.KING_PASSWORD || "zivv-king-dev-secret"); }
function kingToken(dayStr) {
  const day = dayStr || new Date().toISOString().slice(0, 10);
  const sig = crypto.createHmac("sha256", kingSecret()).update("king:" + day).digest("hex").slice(0, 32);
  return "K1." + day + "." + sig;
}
function verifyKingToken(tok) {
  const m = String(tok || "").match(/^K1\.(\d{4}-\d{2}-\d{2})\.([0-9a-f]{32})$/);
  if (!m) return false;
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (m[1] !== today && m[1] !== yest) return false;
  try {
    const a = Buffer.from(kingToken(m[1]));
    const b = Buffer.from(String(tok));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
async function verifyKingPassword(pw) {
  const env = String(process.env.KING_PASSWORD || "");
  if (!env) return false;
  if (env.startsWith("$2a$") || env.startsWith("$2b$")) return bcrypt.compare(String(pw || ""), env);
  return String(pw || "") === env;
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(username);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateId,
  sanitizeUser,
  normalizeEmail,
  kingSecret,
  kingToken,
  verifyKingToken,
  verifyKingPassword,
  validateEmail,
  validateUsername,
};
