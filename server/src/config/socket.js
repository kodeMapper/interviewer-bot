/**
 * Socket.io Configuration
 */

const { Server } = require('socket.io');
const { config } = require('./environment');

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Note: Connection/disconnection logging is done in interviewSocket.js
  // to avoid duplicate logs

  console.log('🔌 Socket.io handlers initialized');
  return io;
};

module.exports = { initializeSocket };
