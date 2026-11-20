// Neon Harbor — scripts/check.mjs
// The pre-submit check, run with Node 22 from the repository root:
//   node scripts/check.mjs
// Six checks: unit tests pass, no forbidden commercial-game words anywhere,
// three.js is the exact vendored build, 4 screenshots within the cap,
// owner.json names the payout wallet, and main.ts writes a dossier.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 1. Unit tests.
{
  const run = spawnSync(process.execPath, ['--test', 'tests/*.test.mjs'], {
    cwd: here, shell: true, encoding: 'utf-8',
  });
  const out = (run.stdout || '') + (run.stderr || '');
  const m = out.match(/# pass (\d+)/);
  const f = out.match(/# fail (\d+)/);
  check('node test suite', run.status === 0, m ? `${m[1]} passed, ${f ? f[1] : '?'} failed` : 'no summary');
}

// 2. No forbidden commercial-game words in any text file.
{
  const banned = ['GTA', 'Rockstar', 'Vice City', 'Los Santos', 'San Andreas', 'Liberty City'];
  const hits = [];
  for (const file of walk(here)) {
    const rel = file.slice(here.length + 1);
    if (rel.startsWith('.git/') || rel.startsWith('out/') || rel.startsWith('out-check/')) continue;
    if (rel === 'scripts/check.mjs') continue; // the banned-words list lives here
    if (!['.js', '.mjs', '.ts', '.html', '.json', '.md', '.txt'].includes(extname(file))) continue;
    const text = readFileSync(file, 'utf-8');
    for (const word of banned) {
      if (text.includes(word)) hits.push(`${rel}: ${word}`);
    }
  }
  check('no forbidden commercial-game words', hits.length === 0, hits.slice(0, 5).join('; ') || 'clean');
}

// 3. three.js is the exact vendored r170 build.
{
  const p = join(here, 'game/vendor/three.module.min.js');
  const size = existsSync(p) ? statSync(p).size : -1;
  check('three.module.min.js is 691648 bytes', size === 691648, `${size} bytes`);
}

// 4. Screenshots: 3-4 files, each at most 256 KiB.
{
  const dir = join(here, 'screenshots');
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    : [];
  const oversize = files.filter((f) => statSync(join(dir, f)).size > 262144);
  check('screenshots 3-4 files, each <= 256 KiB', files.length >= 3 && files.length <= 4 && oversize.length === 0, `${files.length} files`);
}

// 5. owner.json names the payout wallet.
{
  const p = join(here, '.makefun/owner.json');
  let ok = false;
  let detail = 'missing';
  if (existsSync(p)) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8'));
      ok = data.wallet === 'EM5vCYNjPjRXeRdZdBXrLosLGRikAcETqdwN7BJA7Luy';
      detail = ok ? 'wallet set' : `wallet is ${data.wallet}`;
    } catch { detail = 'unparseable'; }
  }
  check('.makefun/owner.json wallet', ok, detail);
}

// 6. main.ts writes out-check/dossier.json.
{
  const run = spawnSync(process.execPath, ['main.ts'], {
    cwd: here, encoding: 'utf-8',
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: 'out-check' },
  });
  const ok = run.status === 0 && existsSync(join(here, 'out-check/dossier.json'));
  check('main.ts writes out-check/dossier.json', ok, run.status === 0 ? 'written' : (run.stderr || 'failed').slice(0, 200));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
