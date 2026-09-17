require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use('/api/', rateLimit({ windowMs: 60e3, max: 300 }));

app.get('/health', (req, res) => res.json({ ok: true, service: 'zivv-api', time: new Date().toISOString() }));

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

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
app.set('io', io);
require('./realtime/socket')(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => console.log(`✦ ZIVV API on :${PORT}`));
