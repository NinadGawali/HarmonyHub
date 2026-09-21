const crypto = require('crypto');
const { redis } = require('../config/redis');
const { config } = require('../config/env');

const key = (sessionId) => `session:${sessionId}`;

const ttlFor = (isGuest) => (isGuest ? config.session.guestTtlSeconds : config.session.userTtlSeconds);

const createSession = async ({ userId, isGuest }) => {
  const sessionId = crypto.randomBytes(32).toString('base64url');
  const ttlSeconds = ttlFor(isGuest);
  await redis.set(key(sessionId), JSON.stringify({ userId, isGuest }), { EX: ttlSeconds });
  return { sessionId, ttlSeconds };
};

// Returns the session and extends its lifetime (sliding expiry), or null.
const getSession = async (sessionId) => {
  if (!sessionId) return null;

  const raw = await redis.get(key(sessionId));
  if (!raw) return null;

  const session = JSON.parse(raw);
  await redis.expire(key(sessionId), ttlFor(session.isGuest));
  return session;
};

const destroySession = async (sessionId) => {
  if (sessionId) {
    await redis.del(key(sessionId));
  }
};

module.exports = { createSession, getSession, destroySession, ttlFor };
