import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(platformRoot, '..', '..');
const releaseRoot = path.join(projectRoot, 'release', 'extensions');
const platformIconRoot = path.join(platformRoot, 'icons');

const targets = {
  chromium: {
    manifest: path.join(platformRoot, 'manifests', 'chromium.json'),
    output: path.join(releaseRoot, 'chromium-platform'),
  },
  firefox: {
    manifest: path.join(platformRoot, 'manifests', 'firefox.json'),
    output: path.join(releaseRoot, 'firefox-platform'),
  },
};

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  await fs.cp(from, to, { recursive: true });
}

async function buildTarget(name, config) {
  await fs.rm(config.output, { recursive: true, force: true });
  await fs.mkdir(config.output, { recursive: true });

  await Promise.all([
    copyDir(path.join(platformRoot, 'background'), path.join(config.output, 'background')),
    copyDir(path.join(platformRoot, 'content'), path.join(config.output, 'content')),
    copyDir(path.join(platformRoot, 'popup'), path.join(config.output, 'popup')),
    copyDir(path.join(platformRoot, 'options'), path.join(config.output, 'options')),
    copyDir(path.join(platformRoot, 'sidepanel'), path.join(config.output, 'sidepanel')),
    copyDir(path.join(platformRoot, 'shared'), path.join(config.output, 'shared')),
    copyDir(platformIconRoot, path.join(config.output, 'icons')),
  ]);

  await fs.copyFile(config.manifest, path.join(config.output, 'manifest.json'));
  console.log(`Built ${name} extension at ${path.relative(projectRoot, config.output)}`);
}

async function main() {
  const target = process.argv[2] || 'all';
  if (target === 'all') {
    for (const [name, config] of Object.entries(targets)) {
      await buildTarget(name, config);
    }
    return;
  }

  if (!targets[target]) {
    throw new Error(`Unknown extension target "${target}". Expected one of: all, ${Object.keys(targets).join(', ')}`);
  }

  await buildTarget(target, targets[target]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
