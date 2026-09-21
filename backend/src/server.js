const { config, validateConfig } = require('./config/env');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const votingSocket = require('./sockets/votingSocket');
const { connectRedis, disconnectRedis } = require('./config/redis');
const { prisma } = require('./config/db');

const SHUTDOWN_TIMEOUT_MS = 10000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

votingSocket(io);

const connectDependencies = async () => {
  // Redis retries in the background, so this resolves once it is reachable.
  connectRedis().catch((error) => console.error('Redis connection failed:', error.message));

  try {
    await prisma.$connect();
    console.log('✅ Postgres connected');
  } catch (error) {
    console.error(`❌ Postgres connection failed: ${error.message.split('\n').pop()}`);
    console.error('   Start dependencies with `npm run dev:deps` from the repo root, then `npm run db:migrate`.');
  }
};

const start = async () => {
  validateConfig().forEach((problem) => console.warn(`⚠️  ${problem}`));

  await connectDependencies();

  server.listen(config.port, () => {
    console.log(`🎵 HarmonyHub backend listening on http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(`🏥 Health check: http://localhost:${config.port}/health`);
  });
};

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  io.close();
  server.close();
  await Promise.allSettled([prisma.$disconnect(), disconnectRedis()]);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
