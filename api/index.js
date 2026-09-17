// Vercel serverless entry — same Express app, HTTP only.
// Realtime sockets don't run on serverless; chat/calls use REST here,
// upgrade path: Pusher/Ably or a dedicated realtime VPS (see docs/VERCEL.md).
const createApp = require('../backend/src/app');

const app = createApp();
module.exports = app;
