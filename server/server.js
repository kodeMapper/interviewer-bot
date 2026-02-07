/**
 * Server Entry Point
 * Initializes database, socket server, and starts HTTP server
 */

const http = require('http');
const app = require('./src/app');
const { config } = require('./src/config/environment');
const { connectDatabase } = require('./src/config/database');
const { initializeSocket } = require('./src/config/socket');
const { seedQuestionBank } = require('./src/utils/seedQuestions');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);

// Make io accessible to routes
app.set('io', io);

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    console.log('✅ Database connected');

    // Seed question bank if empty
    await seedQuestionBank();
    console.log('✅ Question bank ready');

    // Start listening
    server.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎤 AI Smart Interviewer Server                           ║
║                                                            ║
║   Status: Running                                          ║
║   Port: ${config.port}                                           ║
║   Environment: ${config.nodeEnv.padEnd(20)}                  ║
║   MongoDB: Connected                                       ║
║   Socket.io: Ready                                         ║
║                                                            ║
║   Endpoints:                                               ║
║   - Health: http://localhost:${config.port}/health               ║
║   - API: http://localhost:${config.port}/api                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Socket event handlers
    require('./src/socket/interviewSocket')(io);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Start the server
startServer();
// restart

// restart-gemini-fix

// restart-prompts-fix

// restart-models-fix

// models-fixed-2026
