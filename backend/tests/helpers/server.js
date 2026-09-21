// Starts the real backend in a child process for end-to-end tests.
// Requires Postgres and Redis to be running (`npm run dev:deps` from the repo root).
const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');

const TEST_PORT = Number(process.env.TEST_PORT || 3999);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const EVENT_TIMEOUT_MS = 4000;

const startServer = async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '../../src/server.js')], {
    env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test' },
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
});

const request = async (method, url, body) => {
  const response = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
};

const connectClient = () => new Promise((resolve, reject) => {
  const client = io(BASE_URL, { transports: ['websocket'], forceNew: true });
  client.once('connect', () => resolve(client));
  client.once('connect_error', reject);
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

module.exports = { BASE_URL, startServer, stopServer, request, connectClient, nextEvent, firstEvent };
