import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, file), 'utf8'));
}

test('chromium manifest includes side panel support', async () => {
  const manifest = await readJson('extensions/platform/manifests/chromium.json');
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, 'sidepanel/sidepanel.html');
  assert.equal(manifest.permissions.includes('sidePanel'), true);
});

test('firefox manifest excludes Chromium-only side panel support', async () => {
  const manifest = await readJson('extensions/platform/manifests/firefox.json');
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel, undefined);
  assert.equal(manifest.permissions.includes('sidePanel'), false);
  assert.equal(Boolean(manifest.browser_specific_settings?.gecko?.strict_min_version), true);
});

test('manifests keep local bridge permissions explicit', async () => {
  const chromium = await readJson('extensions/platform/manifests/chromium.json');
  const firefox = await readJson('extensions/platform/manifests/firefox.json');
  for (const manifest of [chromium, firefox]) {
    assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1/*', 'http://localhost/*']);
    assert.equal(manifest.permissions.includes('activeTab'), true);
    assert.equal(manifest.permissions.includes('storage'), true);
  }
});
