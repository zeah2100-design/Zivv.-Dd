// Secure upload flow: validate → presign → client uploads to S3 → webhook completes → pipeline.
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { presignUpload, publicUrl } = require('../lib/storage');

const ALLOWED = { 'image/jpeg': 15e6, 'image/png': 15e6, 'image/webp': 15e6, 'video/mp4': 500e6, 'video/webm': 500e6, 'audio/mpeg': 60e6, 'audio/mp4': 60e6 };

router.post('/presign', requireAuth, async (req, res) => {
  const { contentType, kind = 'post', bytes = 0 } = req.body || {};
  const max = ALLOWED[contentType];
  if (!max) return res.status(415).json({ error: 'unsupported_type' });
  if (bytes > max) return res.status(413).json({ error: 'too_large', max });
  if (kind === 'feed-video' && req.body.durationSec > 300) return res.status(422).json({ error: 'feed_video_max_5min' });
  const ext = contentType.split('/')[1];
  const key = `${kind}/${req.user.id}/${Date.now()}-${uuid().slice(0, 8)}.${ext}`;
  const r = await presignUpload(key, contentType);
  res.json({ ...r, cdnUrl: publicUrl(key) });
});

router.post('/complete', requireAuth, (req, res) => {
  const { objectKey, kind } = req.body || {};
  // enqueue: resize/transcode/thumbs/AV-scan (worker picks up from Redis in prod)
  res.json({ ok: true, objectKey, status: 'processing', cdnUrl: publicUrl(objectKey) });
});

module.exports = router;
