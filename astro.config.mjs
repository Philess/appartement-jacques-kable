import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { publicationErrors } from './scripts/publication.mjs';

const config = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));
const release = process.env.SITE_MODE === 'release';
if (release) {
  const errors = publicationErrors(config);
  if (errors.length) throw new Error(`Publication impossible :\n- ${errors.join('\n- ')}`);
}
export default defineConfig({
  output: 'static',
  outDir: release ? './dist-release' : './dist',
  site: release ? config.siteUrl : undefined,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  vite: { define: { __SITE_RELEASE__: JSON.stringify(release) } },
});
