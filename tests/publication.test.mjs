import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { publicationErrors, validEmail, validPhone } from '../scripts/publication.mjs';
import { ready, unconfigured } from './fixtures/publication.mjs';

// These values exist only in a validator fixture, never in the generated site.
test('an unconfigured site cannot be published accidentally', () => {
  assert.equal(unconfigured.allowPublication, false);
  assert.ok(publicationErrors(unconfigured).length >= 10);
});
test('a complete fixture satisfies the publication validator', () => {
  assert.deepEqual(publicationErrors(ready), []);
});
test('every confirmation is mandatory', () => {
  for (const key of ['allowPublication', 'informationVerified', 'mandateCleared']) {
    assert.ok(publicationErrors({ ...ready, [key]: false }).length);
  }
});
test('incomplete legal data, contact and diagnostics prevent publication', () => {
  for (const key of ['contactPhone', 'contactEmail', 'editorLegalNotice', 'hostName', 'hostAddress', 'privacyNotice']) {
    assert.ok(publicationErrors({ ...ready, [key]: '' }).length, key);
  }
  for (const value of [null, -1, Infinity, NaN, '95']) {
    assert.ok(publicationErrors({ ...ready, energyConsumption: value }).length);
    assert.ok(publicationErrors({ ...ready, greenhouseEmissions: value }).length);
    assert.ok(publicationErrors({ ...ready, verifiedChargesMonthly: value }).length);
    assert.ok(publicationErrors({ ...ready, verifiedAnnualBudgetShare: value }).length);
  }
});
test('invalid or placeholder domains cannot become canonical URLs', () => {
  for (const siteUrl of [
    '', 'invalid', 'http://validation-vente-fixture.fr/', 'https://localhost/',
    'https://127.0.0.1/', 'https://192.168.1.2/', 'https://example.com/',
    'https://vente.example/', 'https://vente.test/', 'https://site.local/',
    'https://validation-vente-fixture.fr/preview/', 'https://user:pass@vente.fr/',
    'https://validation-vente-fixture.fr/?draft=1',
  ]) assert.ok(publicationErrors({ ...ready, siteUrl }).length, siteUrl);
  assert.ok(publicationErrors({ ...ready, hostUrl: 'javascript:alert(1)' }).length);
});
test('malformed configurations fail explicitly', () => {
  for (const input of [null, undefined, false, 'config', []]) {
    assert.ok(publicationErrors(input).length);
  }
});
test('the gallery has exactly 23 distinct source photos and no duplicate 18', () => {
  const photos = JSON.parse(readFileSync(new URL('../src/data/photos.json', import.meta.url), 'utf8'));
  assert.equal(photos.length, 23);
  assert.equal(new Set(photos.map((photo) => photo.id)).size, 23);
  assert.ok(!photos.some((photo) => photo.id === 18));
  assert.deepEqual(photos.slice(0, 10).map((photo) => photo.id), [14, 22, 3, 8, 17, 13, 11, 12, 4, 6]);
  const hashes = new Set();
  for (const photo of photos) {
    assert.ok(photo.alt && photo.title);
    assert.ok(existsSync(new URL(`../src/assets/photos/${photo.file}`, import.meta.url)));
    hashes.add(createHash('sha256').update(readFileSync(new URL(`../src/assets/photos/${photo.file}`, import.meta.url))).digest('hex'));
  }
  assert.equal(hashes.size, 23);
});
test('tax year and proceedings are explicit rather than inferred', () => {
  for (const propertyTaxYear of [null, '', 0, 2025.5, new Date().getFullYear() + 1]) {
    assert.ok(publicationErrors({ ...ready, propertyTaxYear }).length);
  }
  for (const coownershipProceedings of ['', null, 'unknown']) {
    assert.ok(publicationErrors({ ...ready, coownershipProceedings }).length);
  }
  assert.ok(publicationErrors({ ...ready, coownershipProceedings: 'ongoing' }).length);
  assert.deepEqual(publicationErrors({ ...ready, coownershipProceedings: 'ongoing', coownershipProceedingsDetails: 'Description vérifiée de test.' }), []);
});
test('each contact is independently validated before creating a link', () => {
  assert.equal(validEmail(ready.contactEmail), true);
  assert.equal(validPhone(ready.contactPhone), true);
  for (const value of ['', null, 'invalid', 'x@example.com', 'x@site.fr?bcc=x@y.fr']) {
    assert.equal(validEmail(value), false);
  }
  for (const value of ['', null, '+', '123', 'javascript:123456789']) {
    assert.equal(validPhone(value), false);
  }
});
test('both map assets are local and contain no remote image or script', () => {
  for (const name of ['quartier-jacques-kable.svg', 'quartier-jacques-kable-mobile.svg']) {
    const svg = readFileSync(new URL(`../public/maps/${name}`, import.meta.url), 'utf8');
    assert.ok(svg.includes('RUE JACQUES KABLÉ'));
    assert.ok(svg.includes('© les contributeurs OpenStreetMap'));
    assert.ok(!/<(?:script|image|iframe|foreignObject)\b/i.test(svg));
    assert.ok(!/\bhref=["']https?:/i.test(svg));
  }
});
