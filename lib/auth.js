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
  validateEmail,
  validateUsername,
};
