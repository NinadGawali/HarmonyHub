const axios = require('axios');
const { redis } = require('../config/redis');
const { prisma } = require('../config/db');
const { config } = require('../config/env');

const CHECK_TIMEOUT_MS = 2000;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms))
]);

const runCheck = async (name, required, probe) => {
  const startedAt = Date.now();
  try {
    await withTimeout(probe(), CHECK_TIMEOUT_MS);
    return { name, required, status: 'up', latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { name, required, status: 'down', error: error.message };
  }
};

// Required dependencies decide overall health; optional ones are reported only.
const getHealth = async () => {
  const checks = await Promise.all([
    runCheck('postgres', true, () => prisma.$queryRaw`SELECT 1`),
    runCheck('redis', true, () => (redis.isReady ? redis.ping() : Promise.reject(new Error('not connected')))),
    runCheck('recommender', false, () => axios.get(`${config.recommenderUrl}/health`, { timeout: CHECK_TIMEOUT_MS }))
  ]);

  const healthy = checks.every((check) => !check.required || check.status === 'up');

  return {
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: Object.fromEntries(checks.map(({ name, ...rest }) => [name, rest]))
  };
};

module.exports = { getHealth };
