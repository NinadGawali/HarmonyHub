require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const votingSocket = require('./sockets/votingSocket');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Setup socket handlers
votingSocket(io);

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     🎵 HarmonyHub Backend Server      ║
╚════════════════════════════════════════╝

✅ Server running on port ${PORT}
🔌 WebSocket ready for connections
📡 API available at http://localhost:${PORT}
🏥 Health check: http://localhost:${PORT}/health

Environment: ${process.env.NODE_ENV || 'development'}
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
