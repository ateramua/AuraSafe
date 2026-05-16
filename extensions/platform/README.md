# AuraSafe Extension Platform

This folder contains the rebuilt browser extension platform. The legacy `extensions/chrome` and `extensions/firefox` implementations have been removed so this platform is the browser extension source of truth.

## Targets

- `chromium`: Chrome, Microsoft Edge, Brave, and Arc.
- `firefox`: Firefox-specific manifest and packaging.
- `safari`: future Safari Web Extension wrapper generated from the Chromium build.

## Development Model

The platform is organized around shared browser-safe modules:

- `shared/browser`: cross-browser runtime API helpers.
- `shared/bridge`: local desktop bridge discovery, handshake, and command calls.
- `shared/domain`: URL/domain matching helpers.
- `shared/storage`: storage and future encryption wrappers.
- `shared/state`: session state helpers.
- `shared/theme`: shared design tokens.
- `background`: MV3 service worker.
- `content`: autofill and page integration.
- `popup`: primary extension UI.
- `options`: settings and diagnostics UI.
- `sidepanel`: richer companion surface for browsers that support side panels.

## Build

```bash
npm run extension:platform:build
```

Outputs are written to:

```text
release/extensions/chromium-platform
release/extensions/firefox-platform
```

Load `release/extensions/chromium-platform` as an unpacked extension in Chromium browsers for local testing.

## Package

```bash
npm run extension:platform:package
```

Packaged ZIP artifacts and checksums are written to:

```text
release/extensions/packages/
release/extensions/packages/extension-packages.json
```

## Store Readiness

Store submission notes live in:

```text
extensions/platform/store/STORE_LISTING.md
extensions/platform/store/PRIVACY_DISCLOSURE.md
extensions/platform/store/RELEASE_CHECKLIST.md
```

The Chromium package includes the side panel. The Firefox package omits side panel manifest keys because Firefox does not support the Chromium side panel API.

## Validation

```bash
npm run extension:platform:test
npm run extension:platform:validate
```

The test command runs Node unit tests for domain matching, bridge protocol invariants, and manifest expectations.

The validation command builds and packages both targets, runs the unit tests, runs Firefox `web-ext lint`, parses source and generated manifests, syntax-checks platform JavaScript files, verifies target-specific manifest expectations, and confirms package SHA-256 checksums.

The same command is wired into `.github/workflows/extension-platform.yml` for pull requests and pushes that touch extension platform files.
