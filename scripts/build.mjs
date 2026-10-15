import { readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { publicationErrors } from './publication.mjs';

const mode = process.argv[2];
if (!['preview', 'release'].includes(mode)) {
  console.error('Mode de build requis : preview ou release.');
  process.exit(1);
}
if (mode === 'release') {
  // Un refus ne doit jamais laisser un ancien livrable publiable à sa place.
  rmSync(new URL('../dist-release/', import.meta.url), { recursive: true, force: true });
  const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
  const errors = publicationErrors(config);
  if (errors.length) {
    console.error(`Publication bloquée :\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
}
const require = createRequire(import.meta.url);
const packagePath = require.resolve('astro/package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const executable = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.astro;
const result = spawnSync(process.execPath, [
  resolve(dirname(packagePath), executable), 'build',
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, SITE_MODE: mode },
  stdio: 'inherit',
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
