// scripts/check.mjs — one-command verification gate for Neon Harbor (plan 001).
// Stdlib only. Run from the repo root: `node scripts/check.mjs`.
//
// Steps (in order, fail fast):
//   1. syntax  — `node --check` on every file in game/src/*.js
//   2. smoke   — serve game/ (serve.ts, port 8080), fetch / and assert
//                HTTP 200 and that the body contains "NEON HARBOR"
//   3. kit check — `cli/makefun.mjs check --kit . --repo <this repo>`
// Prints one `PASS: <step>` line per step and exits 0 only if all pass;
// on failure prints `FAIL: <step> — <reason>` and exits 1.
//
// Notes:
// - Paths resolve from this file's location, so the script works from any
//   cwd, in the main repo or in a worktree.
// - The kit lives outside the repo; its path defaults to the known
//   location and can be overridden with MAKEFUN_KIT_DIR.
// - The smoke fetch uses node:http directly (no proxy env vars involved).

import { execFile, spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { get as httpGet } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;
const KIT_DIR = process.env.MAKEFUN_KIT_DIR
  || '/home/hatch/workspace/makefun/kits/gta6-01-kit/gta6-01-kit';
const PORT = 8080;

class StepError extends Error {
  constructor(step, message, detail = '') {
    super(message);
    this.step = step;
    this.detail = detail;
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(cmd, args, { timeout: 120000, ...opts }, (err, stdout, stderr) => {
      if (err) {
        const error = new Error(err.message);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolvePromise({ stdout, stderr });
      }
    });
  });
}

function fetchBody(url, timeoutMs = 5000) {
  return new Promise((resolvePromise, reject) => {
    const req = httpGet(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolvePromise({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
  });
}

async function stepSyntax() {
  const files = (await readdir(join(ROOT, 'game', 'src')))
    .filter((f) => f.endsWith('.js'))
    .sort();
  if (files.length === 0) {
    throw new StepError('syntax', 'no .js files found in game/src');
  }
  for (const file of files) {
    try {
      await run(NODE, ['--check', join(ROOT, 'game', 'src', file)]);
    } catch (err) {
      throw new StepError('syntax', `node --check failed for game/src/${file}`,
        (err.stderr || err.stdout || err.message).trim());
    }
  }
}

async function stepSmoke() {
  const server = spawn(NODE, ['serve.ts'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  server.stderr.on('data', (chunk) => { stderr += chunk; });
  const exited = new Promise((resolvePromise) => {
    server.on('exit', (code) => resolvePromise(code));
  });
  try {
    const deadline = Date.now() + 10000;
    let lastErr = null;
    let up = false;
    while (Date.now() < deadline) {
      const exitCode = await Promise.race([
        exited.then((code) => ({ exited: true, code })),
        new Promise((r) => { setTimeout(() => r({ exited: false }), 250); }),
      ]);
      if (exitCode.exited) {
        throw new StepError('smoke',
          `serve.ts exited early with code ${exitCode.code}`, stderr.trim());
      }
      try {
        await fetchBody(`http://127.0.0.1:${PORT}/`);
        up = true;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!up) {
      throw new StepError('smoke', 'server did not respond within 10 s',
        lastErr ? lastErr.message : stderr.trim());
    }
    const { status, body } = await fetchBody(`http://127.0.0.1:${PORT}/`);
    if (status !== 200) {
      throw new StepError('smoke', `expected HTTP 200, got ${status}`);
    }
    if (!body.includes('NEON HARBOR')) {
      throw new StepError('smoke', 'page body does not contain "NEON HARBOR"');
    }
  } finally {
    server.kill('SIGTERM');
    await Promise.race([
      exited,
      new Promise((r) => { setTimeout(r, 2000); }),
    ]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
}

async function stepKitCheck() {
  try {
    await run(NODE, ['cli/makefun.mjs', 'check', '--kit', '.', '--repo', ROOT],
      { cwd: KIT_DIR });
  } catch (err) {
    throw new StepError('kit check',
      'cli/makefun.mjs check failed',
      (err.stdout || err.stderr || err.message).trim());
  }
}

try {
  await stepSyntax();
  console.log('PASS: syntax');
  await stepSmoke();
  console.log('PASS: smoke');
  await stepKitCheck();
  console.log('PASS: kit check');
} catch (err) {
  if (err instanceof StepError) {
    console.error(`FAIL: ${err.step} — ${err.message}`);
    if (err.detail) console.error(err.detail);
  } else {
    console.error(`FAIL: ${err.message}`);
  }
  process.exitCode = 1;
}
