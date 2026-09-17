// Local / VPS server: HTTP + Socket.io realtime. (Vercel uses api/index.js instead.)
const http = require('http');
const { Server } = require('socket.io');
const createApp = require('./app');

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
app.set('io', io);
require('./realtime/socket')(io);

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => console.log(`✦ ZIVV API on :${PORT}`));
}
module.exports = { app, server, io };
