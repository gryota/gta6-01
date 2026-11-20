// Neon Harbor — pre-submit checks (6): tests, forbidden words, three.js size,
// screenshots, owner.json, main.ts dossier. Writes out-check/ (delete after).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'out-check');
const NODE = process.env.NODE22 || `${process.env.HOME}/.local/node22/bin/node`;

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// 1. Unit tests (run once, count from the tap output).
try {
  const out = execFileSync(NODE, ['--test', 'tests/*.test.mjs'], { cwd: root, stdio: 'pipe', shell: true, encoding: 'utf8' });
  const m = out.match(/pass (\d+)/);
  check('node test suite', true, m ? `${m[1]} passed, 0 failed` : 'all passed');
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  const m = out.match(/pass (\d+).*fail (\d+)/s);
  check('node test suite', false, m ? `${m[1]} passed, ${m[2]} failed` : 'tests failed');
}

// 2. Forbidden commercial-game words (excluding this check file itself).
const FORBIDDEN = ['GTA', 'Rockstar', 'Vice City', 'Los Santos', 'San Andreas', 'Liberty City'];
const hits = [];
function scanDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out-check') continue;
      scanDir(p);
    } else if (/\.(js|mjs|ts|html|md|json)$/.test(entry.name)) {
      if (p === join(here, 'check.mjs')) continue; // this file names the words to check for
      const text = readFileSync(p, 'utf8');
      for (const word of FORBIDDEN) {
        if (text.includes(word)) hits.push(`${p.split(root + '/')[1]}: ${word}`);
      }
    }
  }
}
scanDir(root);
check('no forbidden commercial-game words', hits.length === 0, hits.length ? hits.slice(0, 3).join('; ') : 'clean');

// 3. three.js vendored size.
const threePath = join(root, 'game/vendor/three.module.min.js');
const threeSize = existsSync(threePath) ? statSync(threePath).size : 0;
check('three.module.min.js is 691648 bytes', threeSize === 691648, `${threeSize} bytes`);

// 4. Screenshots: 3-4 files, each <= 256 KiB.
const shotsDir = join(root, 'screenshots');
let shotOk = false;
let shotDetail = 'missing';
if (existsSync(shotsDir)) {
  const files = readdirSync(shotsDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  const sizes = files.map((f) => statSync(join(shotsDir, f)).size);
  shotOk = files.length >= 3 && files.length <= 4 && sizes.every((s) => s <= 262144);
  shotDetail = `${files.length} files${sizes.length ? `, max ${Math.max(...sizes)} bytes` : ''}`;
}
check('screenshots 3-4 files, each <= 256 KiB', shotOk, shotDetail);

// 5. owner.json wallet.
let ownerOk = false;
try {
  const owner = JSON.parse(readFileSync(join(root, '.makefun/owner.json'), 'utf8'));
  ownerOk = typeof owner.wallet === 'string' && owner.wallet.length > 20;
  check('.makefun/owner.json wallet', ownerOk, ownerOk ? 'wallet set' : 'wallet missing');
} catch {
  check('.makefun/owner.json wallet', false, 'unreadable');
}

// 6. main.ts writes out-check/dossier.json.
rmSync(outDir, { recursive: true, force: true });
try {
  execFileSync(NODE, ['main.ts'], { cwd: root, stdio: 'pipe', env: { ...process.env, MAKEFUN_OUTPUT_DIR: 'out-check' } });
  const dossier = join(outDir, 'dossier.json');
  check('main.ts writes out-check/dossier.json', existsSync(dossier), existsSync(dossier) ? 'written' : 'missing');
} catch (e) {
  check('main.ts writes out-check/dossier.json', false, String(e.message).slice(0, 120));
}

console.log(`\n${passed}/6 checks passed.`);
if (failed > 0) {
  console.log(`${failed} check(s) failed.`);
  process.exit(1);
}
