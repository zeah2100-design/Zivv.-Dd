// Shared Express app — used by local server (src/index.js, with Socket.io)
// and by Vercel serverless (api/index.js, HTTP only, no sticky sockets).
try {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
} catch { /* Vercel injects env vars directly */ }

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(','), credentials: true }));
  app.use(express.json({ limit: '6mb' })); // allows base64 vision images
  if (!process.env.VERCEL) app.use(morgan('dev'));
  app.use('/api/', rateLimit({ windowMs: 60e3, max: 300 }));

  app.get('/health', (req, res) => res.json({ ok: true, service: 'zivv-api', time: new Date().toISOString() }));
  app.get('/api', (req, res) => res.json({ ok: true, service: 'zivv-api', version: '1.0' }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/feed', require('./routes/feed'));
  app.use('/api/reels', require('./routes/reels'));
  app.use('/api/search', require('./routes/search'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/friends', require('./routes/friends'));
  app.use('/api/chat', require('./routes/chat'));
  app.use('/api/marketplace', require('./routes/marketplace'));
  app.use('/api/ads', require('./routes/ads'));
  app.use('/api/gold', require('./routes/gold'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/media', require('./routes/media'));

  app.use((req, res) => res.status(404).json({ error: 'not_found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'server_error' }); });
  return app;
}

module.exports = createApp;
