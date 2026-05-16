import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(platformRoot, '..', '..');

const jsonFiles = [
  'extensions/platform/manifests/chromium.json',
  'extensions/platform/manifests/firefox.json',
  'release/extensions/chromium-platform/manifest.json',
  'release/extensions/firefox-platform/manifest.json',
  'release/extensions/packages/extension-packages.json',
];

const jsFiles = [
  'extensions/platform/scripts/build-extension.mjs',
  'extensions/platform/scripts/package-extension.mjs',
  'extensions/platform/scripts/validate-extension.mjs',
  'extensions/platform/background/service-worker.js',
  'extensions/platform/content/autofill.js',
  'extensions/platform/popup/popup.js',
  'extensions/platform/options/options.js',
  'extensions/platform/sidepanel/sidepanel.js',
  'extensions/platform/shared/bridge/protocol.js',
  'extensions/platform/shared/bridge/desktopBridgeClient.js',
  'extensions/platform/shared/browser/runtime.js',
  'extensions/platform/shared/domain/domainMatch.js',
  'extensions/platform/shared/logging/logger.js',
  'extensions/platform/shared/state/sessionStore.js',
  'extensions/platform/shared/storage/secureStore.js',
  'extensions/platform/shared/sync/offlineCache.js',
];

function relative(filePath) {
  return path.relative(projectRoot, filePath);
}

async function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}`);
  await execFileAsync(command, args, { cwd: projectRoot });
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, file), 'utf8'));
}

async function fileSha256(file) {
  const contents = await fs.readFile(path.join(projectRoot, file));
  return createHash('sha256').update(contents).digest('hex');
}

async function validateJson() {
  for (const file of jsonFiles) {
    await readJson(file);
  }
  console.log(`Validated ${jsonFiles.length} JSON files`);
}

async function validateScripts() {
  for (const file of jsFiles) {
    await run('node', ['--check', file]);
  }
}

async function validatePackages() {
  const manifest = await readJson('release/extensions/packages/extension-packages.json');
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length < 2) {
    throw new Error('Expected Chromium and Firefox package artifacts');
  }

  for (const artifact of manifest.artifacts) {
    if (!artifact.file || !artifact.sha256 || !artifact.bytes) {
      throw new Error(`Package artifact is missing required metadata: ${JSON.stringify(artifact)}`);
    }
    const stats = await fs.stat(path.join(projectRoot, artifact.file));
    const actualHash = await fileSha256(artifact.file);
    if (stats.size !== artifact.bytes) {
      throw new Error(`${artifact.file} byte size mismatch`);
    }
    if (actualHash !== artifact.sha256) {
      throw new Error(`${artifact.file} SHA-256 mismatch`);
    }
  }
  console.log(`Validated ${manifest.artifacts.length} package artifact${manifest.artifacts.length === 1 ? '' : 's'}`);
}

async function validateManifests() {
  const chromium = await readJson('release/extensions/chromium-platform/manifest.json');
  const firefox = await readJson('release/extensions/firefox-platform/manifest.json');
  if (!chromium.side_panel?.default_path) {
    throw new Error('Chromium manifest must include side_panel.default_path');
  }
  if (firefox.side_panel || firefox.permissions?.includes('sidePanel')) {
    throw new Error('Firefox manifest must not include Chromium side panel keys');
  }
  console.log('Validated target-specific manifest expectations');
}

async function main() {
  await run('npm', ['run', 'extension:platform:package']);
  await run('npm', ['run', 'extension:platform:test']);
  await run('npx', ['web-ext', 'lint', '--source-dir', 'release/extensions/firefox-platform']);
  await validateJson();
  await validateScripts();
  await validateManifests();
  await validatePackages();
  console.log(`Extension platform validation complete in ${relative(projectRoot) || '.'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
