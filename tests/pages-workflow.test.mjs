import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
import { ready, unconfigured } from './fixtures/publication.mjs';

const document = parseDocument(readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8'));
assert.deepEqual(document.errors, []);
const workflow = document.toJS();
const actions = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
  'actions/configure-pages': '45bfe0192ca1faeb007ade9deae92b16b8254a0d',
  'actions/upload-pages-artifact': 'fc324d3547104276b827a68afc52ff2a11cc49c9',
  'actions/deploy-pages': '368f82528645a54fb793d4d04e342629a3f51346',
};
test('Pages is manual, main-only, and defaults to a guarded release', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.on.workflow_dispatch.inputs.mode.default, 'release');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.mode.options, ['release', 'preview']);
  assert.equal(workflow.on.workflow_dispatch.inputs.public_preview_confirmation.default, '');
  assert.equal(workflow.jobs.build.if, "github.ref == 'refs/heads/main'");
});
test('only deployment receives Pages write and OIDC permissions', () => {
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs.build.permissions, { contents: 'read', pages: 'read' });
  assert.deepEqual(workflow.jobs.deploy.permissions, { pages: 'write', 'id-token': 'write' });
  assert.equal(workflow.jobs.deploy.needs, 'build');
  assert.equal(workflow.jobs.deploy.environment.name, 'github-pages');
});
test('verified official actions are pinned and upload only the selected build', () => {
  const steps = [...workflow.jobs.build.steps, ...workflow.jobs.deploy.steps];
  for (const step of steps.filter((step) => step.uses)) {
    const [name, sha] = step.uses.split('@');
    assert.equal(sha, actions[name]);
    assert.match(sha, /^[a-f0-9]{40}$/);
  }
  assert.equal(steps.find((step) => step.uses?.startsWith('actions/checkout@')).with['persist-credentials'], false);
  assert.equal(steps.find((step) => step.uses?.startsWith('actions/configure-pages@')).with.enablement, false);
  const upload = steps.find((step) => step.uses?.startsWith('actions/upload-pages-artifact@'));
  assert.equal(upload.with.path, '${{ steps.build.outputs.artifact_path }}');
  assert.equal(upload.with['include-hidden-files'], false);
  for (const step of steps.filter((step) => step.run)) assert.doesNotMatch(step.run, /\$\{\{/);
  assert.ok(steps.some((step) => step.run === 'npm ci'));
  assert.ok(steps.some((step) => step.run?.includes('npm run check') && step.run.includes('npm test')));
});
test('CLI preflight requires the exact public-preview acknowledgement', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fixture = mkdtempSync(join(root, '.release-test-preflight-'));
  cpSync(join(root, 'scripts'), join(fixture, 'scripts'), { recursive: true });
  const configure = (config) => writeFileSync(join(fixture, 'site.config.json'), JSON.stringify(config));
  const check = (mode, confirmation) => spawnSync(process.execPath, [
    join(fixture, 'scripts', 'pages-build.mjs'), '--check',
  ], { encoding: 'utf8', env: { ...process.env, PAGES_BUILD_MODE: mode, PUBLIC_PREVIEW_CONFIRMATION: confirmation } });
  try {
    configure(unconfigured);
    for (const confirmation of ['', 'true', 'yes', 'public preview']) {
      const result = check('preview', confirmation);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /un aperçu PUBLIC exige/);
    }
    assert.equal(check('preview', 'public preview, noindex is not access control').status, 0);
    assert.equal(check('release', '').status, 1);
    for (const mode of ['other', 'preview; echo unexpected', '$(echo unexpected)']) assert.equal(check(mode, '').status, 1);
    configure(ready);
    assert.equal(check('release', '').status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
