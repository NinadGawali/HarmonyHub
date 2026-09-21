const { redis } = require('../config/redis');

// Fixed-window counter. Returns true while `key` has been hit at most `limit` times in the window.
const allowRequest = async (key, limit, windowSeconds) => {
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }
  return count <= limit;
};

module.exports = { allowRequest };
