// Shared Express app — used by local server (src/index.js, with Socket.io)
// and by Vercel serverless (api/index.js, HTTP only, no sticky sockets).
try {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
} catch { /* Vercel injects env vars directly */ }

require('express-async-errors'); // forward async errors to the error middleware
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Vercel terminates TLS; rate-limit by real client IP
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(','), credentials: true }));
  app.use(express.json({ limit: '6mb' })); // allows base64 vision images
  if (!process.env.VERCEL) app.use(morgan('dev'));
  app.use('/api/', rateLimit({ windowMs: 60e3, max: 300 }));

  app.get(['/health', '/api/health'], (req, res) => res.json({ ok: true, service: 'zivv-api', time: new Date().toISOString() }));
  app.get('/api', (req, res) => res.json({ ok: true, service: 'zivv-api', version: '1.0' }));

  // Mounted under BOTH /api/* and /* so the API works whether Vercel
  // forwards the original path (/api/feed) or a stripped path (/feed).
  const routers = {
    auth: require('./routes/auth'),
    feed: require('./routes/feed'),
    reels: require('./routes/reels'),
    comments: require('./routes/comments'),
    search: require('./routes/search'),
    users: require('./routes/users'),
    friends: require('./routes/friends'),
    chat: require('./routes/chat'),
    marketplace: require('./routes/marketplace'),
    ads: require('./routes/ads'),
    gold: require('./routes/gold'),
    notifications: require('./routes/notifications'),
    admin: require('./routes/admin'),
    ai: require('./routes/ai'),
    media: require('./routes/media'),
  };
  for (const prefix of ['/api', '']) {
    for (const [name, r] of Object.entries(routers)) app.use(`${prefix}/${name}`, r);
  }

  app.use((req, res) => res.status(404).json({ error: 'not_found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'server_error' }); });
  return app;
}

module.exports = createApp;
