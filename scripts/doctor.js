#!/usr/bin/env node
// Checks that a local HarmonyHub setup has everything it needs. No dependencies.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const results = [];
// Optional checks warn instead of failing the run.
const report = (ok, label, hint = '', optional = false) => results.push({ ok, label, hint, optional });

const parseEnvFile = (file) => {
  if (!fs.existsSync(file)) return null;
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
};

const canConnect = (host, port) => new Promise((resolve) => {
  const socket = net.connect({ host, port, timeout: 1500 });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
  socket.once('error', () => resolve(false));
});

const hostPort = (url, fallbackPort) => {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: Number(parsed.port) || fallbackPort };
  } catch {
    return null;
  }
};

(async () => {
  const [major] = process.versions.node.split('.').map(Number);
  report(major >= 20, `Node.js ${process.versions.node}`, 'Install Node.js 20 or newer.');

  try {
    execSync('docker info', { stdio: 'ignore' });
    report(true, 'Docker is running');
  } catch {
    report(false, 'Docker is running', 'Start Docker Desktop, then run `npm run dev:deps`.');
  }

  for (const dir of ['.', 'backend', 'frontend']) {
    report(
      fs.existsSync(path.join(root, dir, 'node_modules')),
      `Dependencies installed (${dir})`,
      'Run `npm run setup`.'
    );
  }

  const env = parseEnvFile(path.join(root, '.env'));
  report(Boolean(env), '.env exists at repo root', 'Copy .env.example to .env.');

  if (env) {
    for (const key of ['DATABASE_URL', 'REDIS_URL']) {
      report(Boolean(env[key]), `${key} is set`, `Set ${key} in .env.`);
    }
    for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'GOOGLE_API_KEY']) {
      report(Boolean(env[key]), `${key} is set`, `Needed for Spotify/AI features. Set ${key} in .env.`, true);
    }

    const services = [
      ['Postgres', hostPort(env.DATABASE_URL, 5432), 'Run `npm run dev:deps`.', false],
      ['Redis', hostPort(env.REDIS_URL, 6379), 'Run `npm run dev:deps`.', false],
      ['Python recommender', hostPort(env.PYTHON_RECOMMENDER_URL || 'http://127.0.0.1:5001', 5001),
        'Start it with `npm run dev` (AI playlists fall back without it).', true]
    ];

    for (const [name, target, hint, optional] of services) {
      const reachable = target ? await canConnect(target.host, target.port) : false;
      report(reachable, `${name} reachable${target ? ` at ${target.host}:${target.port}` : ''}`, hint, optional);
    }
  }

  for (const { ok, label, hint, optional } of results) {
    const icon = ok ? '✅' : optional ? '⚠️ ' : '❌';
    console.log(`${icon} ${label}${ok || !hint ? '' : `\n   → ${hint}`}`);
  }

  const failures = results.filter((result) => !result.ok && !result.optional).length;
  const warnings = results.filter((result) => !result.ok && result.optional).length;
  console.log(failures
    ? `\n${failures} required check(s) failed.`
    : `\nReady to run${warnings ? ` (${warnings} optional warning(s))` : ''}.`);
  process.exitCode = failures ? 1 : 0;
})();
