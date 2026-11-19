// Neon Harbor — main.ts (make.fun gta6-01 entry program)
// Copies game/ and screenshots/ from this repository into the output
// directory (/output in the grader, MAKEFUN_OUTPUT_DIR elsewhere) and
// writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Node 22 standard library only; deterministic,
// so both grader runs write the same bytes.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
for (const sub of ['game', 'screenshots']) {
  const target = join(outDir, sub);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  cpSync(join(repoRoot, sub), target, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Neon Harbor: wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
