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
const releaseRoot = path.join(projectRoot, 'release', 'extensions');
const packageRoot = path.join(releaseRoot, 'packages');

const targets = {
  chromium: {
    source: path.join(releaseRoot, 'chromium-platform'),
    filename: 'aurasafe-companion-chromium.zip',
  },
  firefox: {
    source: path.join(releaseRoot, 'firefox-platform'),
    filename: 'aurasafe-companion-firefox.zip',
  },
};

async function readPackageVersion() {
  const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  return packageJson.version;
}

async function sha256(filePath) {
  const contents = await fs.readFile(filePath);
  return createHash('sha256').update(contents).digest('hex');
}

async function packageTarget(name, config, version) {
  await fs.access(config.source);
  await fs.mkdir(packageRoot, { recursive: true });

  const destination = path.join(packageRoot, config.filename);
  await fs.rm(destination, { force: true });
  await execFileAsync('zip', ['-qr', destination, '.'], { cwd: config.source });

  const checksum = await sha256(destination);
  const stats = await fs.stat(destination);
  return {
    target: name,
    version,
    file: path.relative(projectRoot, destination),
    bytes: stats.size,
    sha256: checksum,
  };
}

async function main() {
  const target = process.argv[2] || 'all';
  const names = target === 'all' ? Object.keys(targets) : [target];
  if (names.some((name) => !targets[name])) {
    throw new Error(`Unknown extension package target "${target}". Expected one of: all, ${Object.keys(targets).join(', ')}`);
  }

  const version = await readPackageVersion();
  const artifacts = [];
  for (const name of names) {
    artifacts.push(await packageTarget(name, targets[name], version));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    artifacts,
  };
  await fs.writeFile(path.join(packageRoot, 'extension-packages.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Packaged ${artifacts.length} extension artifact${artifacts.length === 1 ? '' : 's'} in ${path.relative(projectRoot, packageRoot)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
