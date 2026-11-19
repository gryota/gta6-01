// Neon Harbor — scripts/check.mjs
// Pre-submit regression runner: runs the Node test suite, then checks the
// repo itself — no forbidden commercial-game words, the vendored three.js
// build is the exact expected size, screenshots exist and fit the caps,
// and the claim file names the right wallet. Exits non-zero on any failure.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;

function check(name, ok, detail = '') {
  checks++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

// 1. Node test suite.
try {
  const testFiles = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => join('tests', f));
  execFileSync(process.execPath, ['--test', ...testFiles], { cwd: root, stdio: 'pipe' });
  check('node test suite', true);
} catch (err) {
  check('node test suite', false, String(err.stdout || err.message).split('\n').slice(-3).join(' '));
}

// 2. Forbidden commercial-game words anywhere in the entry.
const FORBIDDEN = [/\bGTA\b/, /Rockstar/, /Vice City/, /Los Santos/, /San Andreas/, /Liberty City/];
const textFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'vendor' && entry.name !== 'node_modules') walk(p);
    } else if (/\.(js|mjs|ts|html|md|json)$/.test(entry.name)) {
      textFiles.push(p);
    }
  }
}
walk(join(root, 'game'));
for (const f of ['README.md', 'main.ts', 'serve.ts']) textFiles.push(join(root, f));
let hits = [];
for (const f of textFiles) {
  const text = readFileSync(f, 'utf8');
  for (const re of FORBIDDEN) {
    if (re.test(text)) hits.push(`${f.replace(root + '/', '')}: ${re}`);
  }
}
check('no forbidden commercial-game words', hits.length === 0, hits.join('; '));

// 3. Vendored three.js is the exact expected build.
const three = join(root, 'game/vendor/three.module.min.js');
check(
  'three.module.min.js is 691648 bytes',
  existsSync(three) && statSync(three).size === 691648,
  existsSync(three) ? `${statSync(three).size} bytes` : 'missing'
);

// 4. Screenshots: 3-4 files, each under 256 KiB.
const shotsDir = join(root, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')) : [];
const shotsOk = shots.length >= 3 && shots.length <= 4 && shots.every((f) => statSync(join(shotsDir, f)).size <= 262144);
check('screenshots 3-4 files, each <= 256 KiB', shotsOk, `${shots.length} files`);

// 5. Claim file names the payout wallet.
const ownerPath = join(root, '.makefun/owner.json');
let ownerOk = false;
try {
  const owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
  ownerOk = owner.wallet === 'EM5vCYNjPjRXeRdZdBXrLosLGRikAcETqdwN7BJA7Luy';
} catch {
  ownerOk = false;
}
check('.makefun/owner.json wallet', ownerOk);

// 6. Dossier program runs and writes a dossier.
try {
  execFileSync(process.execPath, ['main.ts'], {
    cwd: root,
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: join(root, 'out-check') },
    stdio: 'pipe',
  });
  check('main.ts writes out-check/dossier.json', existsSync(join(root, 'out-check/dossier.json')));
} catch (err) {
  check('main.ts writes out-check/dossier.json', false, String(err.message).split('\n')[0]);
}

console.log(`\n${checks - failures.length}/${checks} checks passed.`);
if (failures.length > 0) {
  console.log(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
