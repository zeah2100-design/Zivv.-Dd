// Direct upload: validate → presign → client PUTs to R2/S3 → publish stores URL.
// Normal users: video 1GB / audio 250MB / image 15MB. Gold = DOUBLE (video 2GB max).
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { presignUpload, publicUrl, isConfigured, cdnBase, resolveUrl } = require('../lib/storage');

const BASE_CAPS = {
  'image/jpeg': 15e6, 'image/png': 15e6, 'image/webp': 15e6,
  'video/mp4': 1e9, 'video/webm': 1e9, 'video/quicktime': 1e9, 'video/x-m4v': 1e9,
  'audio/mpeg': 250e6, 'audio/mp4': 250e6, 'audio/wav': 250e6, 'audio/webm': 250e6, 'audio/ogg': 250e6,
};
const KINDS = new Set(['post', 'reel', 'song']);

router.post('/presign', requireAuth, async (req, res) => {
  const { contentType, kind = 'post', bytes = 0 } = req.body || {};
  const base = BASE_CAPS[contentType];
  if (!base) return res.status(415).json({ error: 'unsupported_type' });
  const me = await db.q('SELECT gold FROM users WHERE id=$1', [req.user.id]);
  const max = me[0]?.gold ? base * 2 : base; // Gold users get double
  if (bytes > max) return res.status(413).json({ error: 'too_large', max, gold: !!me[0]?.gold });
  if (!isConfigured()) return res.status(503).json({ error: 'storage_offline' });
  const ext = (contentType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const safeKind = KINDS.has(kind) ? kind : 'post';
  const key = `${safeKind}/${req.user.id}/${Date.now()}-${uuid().slice(0, 8)}.${ext}`;
  const r = await presignUpload(key, contentType);
  const cdnUrl = cdnBase() ? publicUrl(key) : `r2:${key}`;
  res.json({ ...r, cdnUrl });
});

// Resolve one stored key to a playable URL (preview after upload). Owner-only.
router.get('/resolve', requireAuth, async (req, res) => {
  const { key } = req.query || {};
  if (!key || typeof key !== 'string') return res.status(400).json({ error: 'missing_key' });
  const raw = key.startsWith('r2:') ? key.slice(3) : key;
  const owner = raw.split('/')[1];
  if (owner !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  const stored = key.startsWith('r2:') ? key : `r2:${raw}`;
  const url = await resolveUrl(stored);
  if (!isConfigured() || !url || url === stored) return res.status(404).json({ error: 'not_found' });
  res.json({ url });
});

router.post('/complete', requireAuth, (req, res) => {
  const { objectKey, kind } = req.body || {};
  // enqueue: resize/transcode/thumbs/AV-scan (worker picks up from Redis in prod)
  res.json({ ok: true, objectKey, status: 'processing', cdnUrl: publicUrl(objectKey) });
});

module.exports = router;
