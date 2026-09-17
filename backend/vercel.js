// Vercel Services entrypoint (backend service).
// Exports the Express app as an (req, res) handler.
// Local dev still uses src/index.js (with Socket.io).
module.exports = require('./src/app')();
