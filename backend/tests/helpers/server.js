// Starts the real backend in a child process for end-to-end tests.
// Requires Postgres and Redis to be running (`npm run dev:deps` from the repo root).
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');
const { createClient } = require('redis');
const { PrismaClient } = require('@prisma/client');
const { config } = require('../../src/config/env');

const TEST_PORT = Number(process.env.TEST_PORT || 3999);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const EVENT_TIMEOUT_MS = 4000;

const startServer = async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '../../src/server.js')], {
    env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test', GUEST_CREATION_LIMIT_PER_HOUR: '10000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  // Wait until /health answers (any status) or give up.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE_URL}/health`);
      return child;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  child.kill();
  throw new Error(`Backend did not start:\n${output}`);
};

const stopServer = (child) => new Promise((resolve) => {
  if (!child || child.exitCode !== null) return resolve();
  child.once('exit', resolve);
  child.kill();
  return undefined;
});

// fetch wrapper; `cookie` is sent as the Cookie header. Redirects are not followed.
const request = async (method, url, { body, cookie } = {}) => {
  const response = await fetch(`${BASE_URL}${url}`, {
    method,
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, body: json };
};

const sessionCookieFrom = (headers) => {
  const header = headers.get('set-cookie') || '';
  const match = header.match(new RegExp(`${config.session.cookieName}=([^;]+)`));
  return match ? `${config.session.cookieName}=${match[1]}` : null;
};

// Creates a guest through the public API and returns { cookie, user }.
const createGuestSession = async (displayName = 'Guest') => {
  const response = await request('POST', '/api/auth/guest', { body: { displayName } });
  if (response.status !== 201) {
    throw new Error(`Guest creation failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { cookie: sessionCookieFrom(response.headers), user: response.body.user };
};

// Direct DB/Redis access for fixtures that cannot go through Spotify OAuth in tests.
const createFixtures = async () => {
  const prisma = new PrismaClient();
  const redis = createClient({ url: config.redisUrl });
  await redis.connect();
  const createdUserIds = [];

  // A signed-in Spotify user without real Spotify tokens.
  const createSpotifySession = async (displayName = 'Host') => {
    const user = await prisma.user.create({
      data: { isGuest: false, spotifyId: `test-${crypto.randomUUID()}`, displayName }
    });
    createdUserIds.push(user.id);

    const sessionId = crypto.randomBytes(32).toString('base64url');
    await redis.set(`session:${sessionId}`, JSON.stringify({ userId: user.id, isGuest: false }), { EX: 600 });
    return { cookie: `${config.session.cookieName}=${sessionId}`, user };
  };

  const trackUser = (userId) => createdUserIds.push(userId);

  const cleanup = async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
    await redis.quit();
  };

  return { prisma, redis, createSpotifySession, trackUser, cleanup };
};

const connectClient = (cookie) => new Promise((resolve, reject) => {
  const client = io(BASE_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: cookie ? { cookie } : {}
  });
  client.once('connect', () => resolve(client));
  client.once('connect_error', (error) => {
    client.close();
    reject(error);
  });
});

const nextEvent = (client, event, timeoutMs = EVENT_TIMEOUT_MS) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    client.off(event, onEvent);
    reject(new Error(`Timed out waiting for "${event}"`));
  }, timeoutMs);
  function onEvent(data) {
    clearTimeout(timer);
    resolve(data);
  }
  client.once(event, onEvent);
});

// Resolves with whichever of the given events fires first: { event, data }.
const firstEvent = (client, events, timeoutMs = EVENT_TIMEOUT_MS) => new Promise((resolve, reject) => {
  const handlers = new Map();
  const cleanup = () => {
    clearTimeout(timer);
    handlers.forEach((handler, event) => client.off(event, handler));
  };
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error(`Timed out waiting for any of: ${events.join(', ')}`));
  }, timeoutMs);

  events.forEach((event) => {
    const handler = (data) => {
      cleanup();
      resolve({ event, data });
    };
    handlers.set(event, handler);
    client.on(event, handler);
  });
});

// Emits join_room and waits until the server has sent the joiner's state.
const joinRoom = async (client, roomId) => {
  const joined = nextEvent(client, 'my_votes');
  client.emit('join_room', { roomId });
  return joined;
};

module.exports = {
  BASE_URL,
  startServer,
  stopServer,
  request,
  sessionCookieFrom,
  createGuestSession,
  createFixtures,
  connectClient,
  nextEvent,
  firstEvent,
  joinRoom
};
