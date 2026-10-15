import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { publicationErrors } from './publication.mjs';
import { normalizeBase, normalizeSiteUrl } from './site-address.mjs';

const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const mode = process.env.PAGES_BUILD_MODE ?? 'release';
const confirmation = 'public preview, noindex is not access control';
function fail(message) {
  console.error(`Déploiement Pages bloqué : ${message}`);
  process.exit(1);
}
if (!['release', 'preview'].includes(mode)) fail('mode inconnu.');
if (process.argv[2] !== undefined && process.argv[2] !== '--check') fail('argument inconnu.');
if (mode === 'preview' && process.env.PUBLIC_PREVIEW_CONFIRMATION !== confirmation) {
  fail(`un aperçu PUBLIC exige la confirmation exacte : ${confirmation}`);
}
if (mode === 'release') {
  const errors = publicationErrors(config);
  if (errors.length) fail(`configuration release incomplète :\n- ${errors.join('\n- ')}`);
}
if (process.argv[2] === '--check') process.exit(0);

if (process.env.SITE_BASE === undefined) fail('métadonnées configure-pages manquantes.');
const base = normalizeBase(process.env.SITE_BASE);
const origin = normalizeSiteUrl(process.env.PAGES_ORIGIN);
if (mode === 'release' && (
  normalizeSiteUrl(config.siteUrl) !== origin || normalizeBase(config.basePath) !== base
)) fail('siteUrl/basePath doivent correspondre à la destination configurée dans GitHub Pages.');

const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('./build.mjs', import.meta.url)), mode,
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, SITE_BASE: base },
  stdio: 'inherit',
});
if (result.error) fail(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
const artifact = mode === 'release' ? 'dist-release' : 'dist';
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `artifact_path=${artifact}\n`);
console.log(`Artifact Pages : ${artifact}`);
