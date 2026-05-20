const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
/** Repo root (AuraSafe/), not apps/mobile — required for pnpm workspace packages. */
const monorepoRoot = path.resolve(projectRoot, '../../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
// Required for pnpm symlinks; do not set disableHierarchicalLookup (breaks expo-modules-core).
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
