const { createClient } = require('redis');
const { config } = require('./env');

const MAX_RECONNECT_DELAY_MS = 5000;
const ERROR_LOG_INTERVAL_MS = 10000;

const redis = createClient({
  url: config.redisUrl,
  socket: {
    // Keep retrying with backoff instead of crashing the process when Redis is unavailable.
    reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, MAX_RECONNECT_DELAY_MS)
  }
});

let lastErrorLoggedAt = 0;

redis.on('error', (error) => {
  // A down Redis emits an error per retry; log at most one every few seconds.
  const now = Date.now();
  if (now - lastErrorLoggedAt >= ERROR_LOG_INTERVAL_MS) {
    lastErrorLoggedAt = now;
    console.error(`Redis error (${config.redisUrl}): ${error.message}`);
  }
});

redis.on('ready', () => {
  console.log('✅ Redis connected');
});

const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
  }
};

const disconnectRedis = async () => {
  if (redis.isOpen) {
    await redis.quit();
  }
};

module.exports = { redis, connectRedis, disconnectRedis };
