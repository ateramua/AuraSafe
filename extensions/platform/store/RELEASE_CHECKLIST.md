# AuraSafe Companion Release Checklist

## Build

- Run `npm run extension:platform:build`.
- Run `npm run extension:platform:package`.
- Run `npm run extension:platform:test`.
- Run `npm run extension:platform:validate`.
- Confirm packages exist in `release/extensions/packages`.
- Confirm `extension-packages.json` includes SHA-256 checksums.

## Validation

- Run Firefox lint with `web-ext lint --source-dir release/extensions/firefox-platform`.
- Validate source and built manifests parse as JSON.
- Run JavaScript syntax checks for platform modules.
- Confirm domain matching, bridge protocol, and manifest tests pass.
- Confirm CI uploads `release/extensions/packages/*` from `.github/workflows/extension-platform.yml`.
- Load `release/extensions/chromium-platform` unpacked in Chrome or Edge.
- Load `release/extensions/firefox-platform` temporarily in Firefox.

## Manual Smoke Tests

- Confirm desktop bridge detection.
- Confirm locked vault and disconnected states render clearly.
- Confirm current-site matching on a known login page.
- Confirm Fill injects only after a user action.
- Confirm offline cache is browse-only and cannot fill credentials.
- Confirm options diagnostics and cache clearing work.
- Confirm Chromium side panel opens and refreshes dashboard data.

## Store Submission

- Review `STORE_LISTING.md`.
- Review `PRIVACY_DISCLOSURE.md`.
- Prepare screenshots for popup, options, side panel, and disconnected state.
- Confirm extension version matches `package.json`.
- Confirm permissions are limited to active tab, storage, scripting, tabs, loopback hosts, and optional all-sites access.
