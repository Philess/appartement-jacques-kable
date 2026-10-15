import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBase, normalizeBase, normalizeSiteUrl } from '../scripts/site-address.mjs';
import { publicationErrors } from '../scripts/publication.mjs';
import { ready } from './fixtures/publication.mjs';

test('deployment base paths are normalized without changing their meaning', () => {
  for (const value of ['', '/', undefined]) assert.equal(normalizeBase(value), '/');
  for (const value of ['/appartement-jacques-kable', '/appartement-jacques-kable/', ' /appartement-jacques-kable/ ']) {
    assert.equal(normalizeBase(value), '/appartement-jacques-kable/');
  }
  assert.equal(normalizeBase('/nested/site'), '/nested/site/');
});
test('ambiguous and unsafe base paths are rejected', () => {
  for (const value of [null, false, 1, 'site', '//host/', '/a//b/', '/./', '/../', '/a/../b/',
    '/%2e%2e/', '/a?b', '/a#b', '/a\\b', '/a b', '/<script>/', 'https://site.fr/']) {
    assert.throws(() => normalizeBase(value), TypeError, String(value));
    assert.ok(publicationErrors({ ...ready, basePath: value }).length);
  }
});
test('siteUrl is an HTTPS origin, while the base is kept separately', () => {
  assert.equal(normalizeSiteUrl(' https://PHILESS.github.io/ '), 'https://philess.github.io');
  for (const value of ['', null, 'https://philess.github.io/appartement-jacques-kable/',
    'http://site.fr/', 'https://site.fr/?q=1', 'https://site.fr/#a', 'https://user:pass@site.fr/',
    'https://127.0.0.1/', 'https://example.com/', 'https://site.fr:8443/']) {
    assert.throws(() => normalizeSiteUrl(value), TypeError, String(value));
  }
});
test('preview defaults to root; an explicit override tests a project path', () => {
  assert.equal(buildBase('/appartement-jacques-kable/', false, undefined), '/');
  assert.equal(buildBase('/appartement-jacques-kable/', true, undefined), '/appartement-jacques-kable/');
  assert.equal(buildBase('/', false, '/appartement-jacques-kable'), '/appartement-jacques-kable/');
  assert.equal(buildBase('/appartement-jacques-kable/', true, ''), '/');
});
