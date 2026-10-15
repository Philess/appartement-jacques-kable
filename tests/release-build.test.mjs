import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ready } from './fixtures/publication.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('real builds isolate fixtures, enforce release gating and force preview by default', { timeout: 600_000 }, () => {
  const original = readFileSync(join(root, 'site.config.json'), 'utf8');
  const fixture = mkdtempSync(join(root, '.release-test-'));
  const report = { incompleteReleaseRejected: false, forcedPreview: false, partialContact: false, completeRelease: false, staleReleaseRemoved: false };
  const configure = (config) => writeFileSync(join(fixture, 'site.config.json'), JSON.stringify(config));
  const run = (mode) => spawnSync(process.execPath, [join(fixture, 'scripts', 'build.mjs'), mode], {
    cwd: fixture, encoding: 'utf8', timeout: 240_000, maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, SITE_MODE: 'release' },
  });
  try {
    for (const name of ['src', 'public', 'scripts', 'package.json', 'astro.config.mjs', 'tsconfig.json']) {
      cpSync(join(root, name), join(fixture, name), { recursive: true });
    }
    configure(JSON.parse(original));
    const rejected = run('release');
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.match(rejected.stderr, /Publication bloquée/);
    assert.ok(!existsSync(join(fixture, 'dist-release')));
    report.incompleteReleaseRejected = true;

    configure({ ...ready, allowPublication: false, contactPhone: '' });
    const preview = run('preview');
    assert.equal(preview.status, 0, preview.stderr || preview.stdout);
    const previewHtml = readFileSync(join(fixture, 'dist', 'index.html'), 'utf8');
    assert.match(previewHtml, /noindex,nofollow/);
    assert.doesNotMatch(previewHtml, /rel="canonical"/);
    assert.match(previewHtml, /href="mailto:vendeur@validation-vente-fixture.fr/);
    assert.doesNotMatch(previewHtml, /href="tel:/);
    assert.match(readFileSync(join(fixture, 'dist', 'robots.txt'), 'utf8'), /Disallow: \//);
    assert.doesNotMatch(readFileSync(join(fixture, 'dist', 'sitemap.xml'), 'utf8'), /<url>/);
    report.forcedPreview = true;
    report.partialContact = true;

    configure(ready);
    const release = run('release');
    assert.equal(release.status, 0, release.stderr || release.stdout);
    const published = readFileSync(join(fixture, 'dist-release', 'index.html'), 'utf8');
    assert.match(published, /content="index,follow,max-image-preview:large"/);
    assert.match(published, /rel="canonical" href="https:\/\/validation-vente-fixture.fr\/"/);
    assert.match(published, /property="og:url" content="https:\/\/validation-vente-fixture.fr\/"/);
    assert.match(published, /href="tel:\+33639980000"/);
    assert.match(published, /href="mailto:vendeur@validation-vente-fixture.fr/);
    assert.match(published, /pour 2025/);
    assert.match(published, /Aucune procédure en cours/);
    assert.doesNotMatch(published, /Millésime à confirmer|Aperçu local|publication désactivée/);
    const schema = JSON.parse(published.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema['@graph'].find((node) => node['@type'] === 'Offer').price, 630000);
    assert.match(readFileSync(join(fixture, 'dist-release', 'robots.txt'), 'utf8'), /Allow: \//);
    assert.match(readFileSync(join(fixture, 'dist-release', 'sitemap.xml'), 'utf8'), /<loc>https:\/\/validation-vente-fixture.fr\/<\/loc>/);
    assert.match(readFileSync(join(fixture, 'dist-release', '404.html'), 'utf8'), /noindex,nofollow/);
    report.completeRelease = true;

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
