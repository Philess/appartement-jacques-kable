import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ready, unconfigured } from './fixtures/publication.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('real builds isolate fixtures, enforce release gating and force preview by default', { timeout: 1_800_000 }, () => {
  const original = readFileSync(join(root, 'site.config.json'), 'utf8');
  const fixture = mkdtempSync(join(root, '.release-test-'));
  const report = { incompleteReleaseRejected: false, forcedPreview: false, partialContact: false, completeRelease: false, staleReleaseRemoved: false };
  const configure = (config) => writeFileSync(join(fixture, 'site.config.json'), JSON.stringify(config));
  const run = (mode) => spawnSync(process.execPath, [join(fixture, 'scripts', 'build.mjs'), mode], {
    cwd: fixture, encoding: 'utf8', timeout: 600_000, maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, SITE_MODE: 'release', SITE_BASE: undefined },
  });
  const pages = (mode, origin, base) => spawnSync(process.execPath, [join(fixture, 'scripts', 'pages-build.mjs')], {
    cwd: fixture, encoding: 'utf8', timeout: 600_000, maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, SITE_MODE: 'release', PAGES_BUILD_MODE: mode, PAGES_ORIGIN: origin, SITE_BASE: base,
      PUBLIC_PREVIEW_CONFIRMATION: 'public preview, noindex is not access control',
      GITHUB_OUTPUT: join(fixture, 'pages-output.txt') },
  });
  try {
    for (const name of ['src', 'public', 'scripts', 'package.json', 'astro.config.mjs', 'tsconfig.json']) {
      cpSync(join(root, name), join(fixture, name), { recursive: true });
    }
    const imageCache = join(root, 'node_modules', '.astro', 'assets');
    if (existsSync(imageCache)) {
      cpSync(imageCache, join(fixture, 'node_modules', '.astro', 'assets'), { recursive: true });
    }
    configure(unconfigured);
    const rejected = run('release');
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.match(rejected.stderr, /Publication bloquée/);
    assert.ok(!existsSync(join(fixture, 'dist-release')));
    report.incompleteReleaseRejected = true;

    configure({ ...ready, basePath: '/appartement-jacques-kable/', allowPublication: false, contactPhone: '' });
    const preview = run('preview');
    assert.ifError(preview.error);
    assert.equal(preview.status, 0, preview.stderr || preview.stdout);
    const previewHtml = readFileSync(join(fixture, 'dist', 'index.html'), 'utf8');
    assert.match(previewHtml, /noindex,nofollow/);
    assert.match(previewHtml, /href="\/#galerie"/);
    assert.doesNotMatch(previewHtml, /rel="canonical"/);
    assert.match(previewHtml, /href="mailto:vendeur@validation-vente-fixture.fr/);
    assert.doesNotMatch(previewHtml, /href="tel:/);
    assert.match(readFileSync(join(fixture, 'dist', 'robots.txt'), 'utf8'), /Disallow: \//);
    assert.doesNotMatch(readFileSync(join(fixture, 'dist', 'sitemap.xml'), 'utf8'), /<url>/);
    report.forcedPreview = true;
    report.partialContact = true;

    configure(ready);
    const release = run('release');
    assert.ifError(release.error);
    assert.equal(release.status, 0, release.stderr || release.stdout);
    const published = readFileSync(join(fixture, 'dist-release', 'index.html'), 'utf8');
    assert.match(published, /content="index,follow,max-image-preview:large"/);
    assert.match(published, /rel="canonical" href="https:\/\/validation-vente-fixture.fr\/"/);
    assert.match(published, /property="og:url" content="https:\/\/validation-vente-fixture.fr\/"/);
    assert.match(published, /href="tel:\+33639980000"/);
    assert.match(published, /href="mailto:vendeur@validation-vente-fixture.fr/);
    assert.match(published, /pour 2025/);
    assert.match(published, /Aucune procédure en cours/);
    assert.doesNotMatch(published, /Millésime à confirmer|Version de préparation|publication désactivée/);
    const schema = JSON.parse(published.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema['@graph'].find((node) => node['@type'] === 'Offer').price, 630000);
    assert.match(readFileSync(join(fixture, 'dist-release', 'robots.txt'), 'utf8'), /Allow: \//);
    assert.match(readFileSync(join(fixture, 'dist-release', 'sitemap.xml'), 'utf8'), /<loc>https:\/\/validation-vente-fixture.fr\/<\/loc>/);
    assert.match(readFileSync(join(fixture, 'dist-release', '404.html'), 'utf8'), /noindex,nofollow/);
    report.completeRelease = true;

    const base = '/appartement-jacques-kable/';
    configure({ ...ready, basePath: base });
    assert.equal(pages('release', 'https://wrong-destination.fr', base).status, 1);
    assert.equal(pages('release', ready.siteUrl, '/wrong-base/').status, 1);
    const projectRelease = pages('release', ready.siteUrl, base.slice(0, -1));
    assert.ifError(projectRelease.error);
    assert.equal(projectRelease.status, 0, projectRelease.stderr || projectRelease.stdout);
    const expectedRoot = new URL(base, ready.siteUrl).href;
    const projectHtml = readFileSync(join(fixture, 'dist-release', 'index.html'), 'utf8');
    assert.ok(projectHtml.includes(`rel="canonical" href="${expectedRoot}"`));
    assert.ok(projectHtml.includes(`property="og:url" content="${expectedRoot}"`));
    assert.ok(projectHtml.includes(`href="${base}#galerie"`));
    assert.ok(projectHtml.includes(`src="${base}maps/quartier-jacques-kable.svg"`));
    const graph = JSON.parse(projectHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
    assert.equal(graph.find((node) => node['@type'] === 'RealEstateListing').url, expectedRoot);
    assert.ok(graph.find((node) => node['@type'] === 'Apartment').image.every((url) => url.startsWith(expectedRoot)));
    assert.ok(readFileSync(join(fixture, 'dist-release', 'sitemap.xml'), 'utf8').includes(`${expectedRoot}mentions-legales/`));
    assert.ok(readFileSync(join(fixture, 'dist-release', 'robots.txt'), 'utf8').includes(`${expectedRoot}sitemap.xml`));
    const legalHtml = readFileSync(join(fixture, 'dist-release', 'mentions-legales', 'index.html'), 'utf8');
    assert.ok(legalHtml.includes(`rel="canonical" href="${expectedRoot}mentions-legales/"`));
    assert.ok(legalHtml.includes(`href="${base}maps/source-osm.json"`));
    const cssUrls = [...projectHtml.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1]);
    assert.ok(cssUrls.length >= 4);
    assert.ok(cssUrls.every((url) => url.startsWith(base)), cssUrls.join(','));
    const publicPreview = pages('preview', ready.siteUrl, base);
    assert.ifError(publicPreview.error);
    assert.equal(publicPreview.status, 0, publicPreview.stderr || publicPreview.stdout);
    const projectPreview = readFileSync(join(fixture, 'dist', 'index.html'), 'utf8');
    assert.match(projectPreview, /noindex,nofollow/);
    assert.doesNotMatch(projectPreview, /rel="canonical"/);
    assert.ok(projectPreview.includes(`href="${base}#galerie"`));
    assert.match(readFileSync(join(fixture, 'pages-output.txt'), 'utf8'), /artifact_path=dist-release\nartifact_path=dist\n/);
    report.projectPathReleaseAndPreview = true;
    report.destinationMismatchRejected = true;

    configure({ ...ready, mandateCleared: false });
    assert.equal(run('release').status, 1);
    assert.ok(!existsSync(join(fixture, 'dist-release')));
    assert.ok(existsSync(join(fixture, 'dist', 'index.html')));
    report.staleReleaseRemoved = true;
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    assert.equal(readFileSync(join(root, 'site.config.json'), 'utf8'), original);
    mkdirSync(join(root, 'verification'), { recursive: true });
    writeFileSync(join(root, 'verification', 'release-report.json'), JSON.stringify(report, null, 2));
  }
});
