#!/usr/bin/env node
// Adds any missing generated secrets to the repo-root .env. Never overwrites existing values.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
const examplePath = path.resolve(__dirname, '..', '.env.example');

const secrets = {
  TOKEN_ENCRYPTION_KEY: () => crypto.randomBytes(32).toString('base64')
};

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('Created .env from .env.example');
}

let content = fs.readFileSync(envPath, 'utf8');

for (const [key, generate] of Object.entries(secrets)) {
  const pattern = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(pattern);

  if (match && match[1].trim()) {
    console.log(`${key} already set, leaving it unchanged`);
    continue;
  }

  const line = `${key}=${generate()}`;
  content = match ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
  console.log(`${key} generated`);
}

fs.writeFileSync(envPath, content);
