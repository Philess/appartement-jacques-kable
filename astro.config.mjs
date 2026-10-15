import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { publicationErrors } from './scripts/publication.mjs';
import { buildBase, normalizeSiteUrl } from './scripts/site-address.mjs';

const config = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));
const release = process.env.SITE_MODE === 'release';
const base = buildBase(config.basePath, release, process.env.SITE_BASE);
const site = config.siteUrl ? normalizeSiteUrl(config.siteUrl) : undefined;
if (release) {
  const errors = publicationErrors(config);
  if (errors.length) throw new Error(`Publication impossible :\n- ${errors.join('\n- ')}`);
}
export default defineConfig({
  output: 'static',
  base,
  outDir: release ? './dist-release' : './dist',
  site: release ? site : undefined,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  vite: { define: { __SITE_RELEASE__: JSON.stringify(release) } },
});
