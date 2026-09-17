// Socket.io: messages, typing, presence, calls signaling, AI live events.
module.exports = function initSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join', (conversationId) => socket.join(conversationId));
    socket.on('typing', ({ conversationId, typing, user }) => {
      socket.to(conversationId).emit('typing', { typing, user });
    });
    socket.on('call:signal', ({ to, signal }) => socket.to(to).emit('call:signal', { from: socket.id, signal }));
    socket.on('presence', ({ online }) => socket.broadcast.emit('presence', { id: socket.id, online }));
    socket.on('disconnect', () => {});
  });
};
