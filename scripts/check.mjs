// Neon Harbor pre-submit checks. Writes only to a temp dir — never to the repo.
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const NODE = process.env.NODE22 || `${process.env.HOME}/.local/node22/bin/node`;
const FORBIDDEN = ['GTA', 'Rockstar', 'Vice City', 'Los Santos', 'San Andreas', 'Liberty City'];
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed++;
  else failed++;
}

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: here, env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, out: stdout + stderr });
    });
  });
}

function walk(dir, files = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

const outDir = mkdtempSync(join(tmpdir(), 'gta6-check-'));
try {
  // 1. Unit tests.
  const t = await run(NODE, ['--test', 'tests/wanted.test.mjs', 'tests/missions.test.mjs', 'tests/save.test.mjs', 'tests/shop.test.mjs', 'tests/money.test.mjs']);
  const m = t.out.match(/# pass (\d+)/);
  check('node test suite', t.code === 0 && m && Number(m[1]) > 0, m ? `${m[1]} passed` : t.out.slice(-200));

  // 2. No forbidden commercial-game words anywhere in the repo.
  const hits = [];
  const selfFile = fileURLToPath(import.meta.url);
  for (const f of walk(here)) {
    if (f === selfFile) continue; // the checker itself holds the word list
    if (/\.(png|jpg|jpeg|min\.js)$/.test(f)) continue;
    try {
      const text = readFileSync(f, 'utf8');
      for (const w of FORBIDDEN) if (text.includes(w)) hits.push(`${f.split('/').slice(-2).join('/')}:${w}`);
    } catch {
      // binary or unreadable — skip
    }
  }
  check('no forbidden commercial-game words', hits.length === 0, hits.length ? hits.slice(0, 3).join(', ') : 'clean');

  // 3. three.js vendored build is exactly 691648 bytes.
  const three = join(here, 'game/vendor/three.module.min.js');
  const threeSize = existsSync(three) ? statSync(three).size : -1;
  check('three.module.min.js is 691648 bytes', threeSize === 691648, `${threeSize} bytes`);

  // 4. Screenshots: 3-4 files, each <= 256 KiB.
  const shotsDir = join(here, 'screenshots');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)) : [];
  const shotSizes = shots.map((f) => statSync(join(shotsDir, f)).size);
  check(
    'screenshots 3-4 files, each <= 256 KiB',
    shots.length >= 3 && shots.length <= 4 && shotSizes.every((s) => s <= 262144),
    `${shots.length} files`,
  );

  // 5. owner.json wallet set.
  let wallet = '';
  try {
    wallet = JSON.parse(readFileSync(join(here, '.makefun/owner.json'), 'utf8')).wallet || '';
  } catch {
    wallet = '';
  }
  check('.makefun/owner.json wallet', wallet.length > 10, wallet ? 'wallet set' : 'missing');

  // 6. main.ts writes dossier.json via buildDossier.
  const r = await run(NODE, ['main.ts'], { MAKEFUN_OUTPUT_DIR: outDir });
  const dossierOk = r.code === 0 && existsSync(join(outDir, 'dossier.json'));
  check('main.ts writes out/dossier.json', dossierOk, dossierOk ? 'written' : r.out.slice(-200));
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(`\n${passed}/6 checks passed.`);
process.exit(failed ? 1 : 0);
