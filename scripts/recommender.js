#!/usr/bin/env node
// Runs the Python recommender from its own virtual environment (recommender/.venv).
//   node scripts/recommender.js setup   create the venv and install dependencies
//   node scripts/recommender.js dev     run the service with auto-reload
//   node scripts/recommender.js test    run the pytest suite
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serviceDir = path.resolve(__dirname, '..', 'recommender');
const venvDir = path.join(serviceDir, '.venv');
const venvPython = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: serviceDir, stdio: 'inherit' });
  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

// The first Python 3.11+ found on PATH (the Windows "py" launcher first).
const findSystemPython = () => {
  const candidates = process.platform === 'win32'
    ? [['py', ['-3.12']], ['py', ['-3']], ['python', []]]
    : [['python3.12', []], ['python3', []], ['python', []]];
  for (const [command, prefix] of candidates) {
    const check = spawnSync(command, [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)']);
    if (!check.error && check.status === 0) {
      return [command, prefix];
    }
  }
  return null;
};

const requireVenv = () => {
  if (!fs.existsSync(venvPython)) {
    console.error('The recommender is not set up yet. Run: npm run setup:recommender');
    process.exit(1);
  }
};

const command = process.argv[2];

if (command === 'setup') {
  if (!fs.existsSync(venvPython)) {
    const python = findSystemPython();
    if (!python) {
      console.error('Python 3.11 or newer is required for the recommender.');
      process.exit(1);
    }
    const [pythonCommand, prefix] = python;
    run(pythonCommand, [...prefix, '-m', 'venv', venvDir]);
  }
  run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', '-r', 'requirements-dev.txt']);
  console.log('Recommender ready.');
} else if (command === 'dev') {
  requireVenv();
  run(venvPython, ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', process.env.PYTHON_RECOMMENDER_HOST || '127.0.0.1',
    '--port', process.env.PYTHON_RECOMMENDER_PORT || '5001']);
} else if (command === 'test') {
  requireVenv();
  run(venvPython, ['-m', 'pytest', '-q']);
} else {
  console.error('Usage: node scripts/recommender.js <setup|dev|test>');
  process.exit(1);
}
