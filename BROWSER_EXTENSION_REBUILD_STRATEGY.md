# AuraSafe Browser Extension Rebuild Strategy

This document defines the architecture, technical decisions, and implementation roadmap for rebuilding the AuraSafe browser extension ecosystem from the ground up while preserving useful parts of the existing prototype.

## Goals

- Provide a premium browser companion for the existing Electron/React/Next.js desktop app.
- Support Chrome, Microsoft Edge, Brave, Arc, Firefox, and Safari with the smallest practical amount of duplicated code.
- Reuse desktop app concepts, vault business logic, design language, and the existing local desktop bridge.
- Keep the extension fast, lightweight, secure, accessible, and maintainable.
- Allow the extension to work in three modes: desktop-connected, cloud-connected, and offline-limited.

## Recommended Architecture

The rebuild should introduce a shared extension platform that lives beside the current browser extension folders until the new implementation reaches feature parity.

```text
AuraSafe/
  extensions/
    platform/
      shared/
        browser/
        bridge/
        crypto/
        domain/
        logging/
        state/
        storage/
        theme/
        validation/
      background/
      content/
      popup/
      options/
      sidepanel/
      manifests/
      scripts/
      dist/
```

The legacy `extensions/chrome` and `extensions/firefox` implementations have been removed. New browser extension work should go under `extensions/platform`.

## Technical Decisions

### Language and Runtime

- Use modern JavaScript first to avoid a large toolchain migration before the core architecture is proven.
- Introduce TypeScript once the platform boundaries stabilize.
- Keep browser-facing modules dependency-light.
- Use ESM modules for background, popup, content, and shared services.

### Build Approach

Phase 1 uses a small local manifest/build script that copies shared assets into browser-specific output folders. Later phases can migrate to WXT, Vite, or Plasmo if the extension needs heavier React bundling.

Recommended eventual tooling:

- WXT or Vite for extension builds.
- React for popup, options, side panel, and onboarding UI.
- Zustand for UI/session state.
- TanStack Query for desktop/cloud data fetching.
- Zod or local schemas for command validation.
- WebCrypto + IndexedDB for encrypted local caches.

## Folder and File Structure

Initial rebuild structure:

```text
extensions/platform/
  README.md
  shared/
    browser/runtime.js
    bridge/desktopBridgeClient.js
    bridge/protocol.js
    domain/domainMatch.js
    logging/logger.js
    state/sessionStore.js
    storage/secureStore.js
    theme/tokens.css
  background/
    service-worker.js
  content/
    autofill.js
    autofill.css
  popup/
    popup.html
    popup.js
    popup.css
  options/
    options.html
    options.js
    options.css
  sidepanel/
    sidepanel.html
    sidepanel.js
    sidepanel.css
  manifests/
    chromium.json
    firefox.json
  scripts/
    build-extension.mjs
  dist/
    chromium/
    firefox/
```

Future structure:

```text
packages/
  shared-core/
  shared-ui/
  extension-core/
  desktop-bridge-client/
apps/
  desktop/
  extension/
```

## Browser Compatibility Strategy

### Chromium Family

Chrome, Edge, Brave, and Arc should share the Chromium Manifest V3 target.

Key APIs:

- `chrome.runtime`
- `chrome.storage`
- `chrome.scripting`
- `chrome.action`
- `chrome.alarms`
- `chrome.notifications`
- `chrome.sidePanel` where available

### Firefox

Firefox should use a separate manifest generated from the same platform source. Prefer Firefox MV3 where supported. Use the browser runtime wrapper in `shared/browser/runtime.js` to normalize callback-vs-promise API differences.

### Safari

Safari should be packaged from the Chromium-compatible build using Safari Web Extension tooling. Safari must be treated as a separate release lane because extension lifecycle and permissions differ.

## Extension to Desktop App Communication Model

The existing desktop bridge is valuable and should be retained, then hardened.

Current bridge endpoints:

```text
GET  /bridge/info
POST /bridge/handshake
GET  /bridge/health
POST /bridge/command
```

Recommended flow:

1. Extension starts.
2. Background service worker scans loopback ports `36000-36020`.
3. It calls `/bridge/info`.
4. It posts `/bridge/handshake`.
5. Desktop returns a short-lived session token.
6. Extension stores the token in session/local storage with expiry.
7. Extension sends typed `/bridge/command` requests.
8. Token expires and the extension re-handshakes.
9. If desktop is unavailable, extension enters cloud/offline mode.

The desktop app must remain bound to `127.0.0.1` and reject non-loopback requests.

## Desktop Bridge Command Protocol

Initial supported commands map to the existing bridge actions:

```text
ping
getVaultEntries
saveVaultEntry
queueAutofill
getPendingAutofill
consumePendingAutofill
getTransactions
getAccounts
getCategories
getUserSettings
saveUserSetting
```

New extension code should use semantic wrapper functions rather than calling raw command strings throughout the UI.

## Authentication and Session Strategy

### Desktop Session

- Short-lived bridge token from `/bridge/handshake`.
- Store expiry alongside token.
- Re-handshake automatically when expired.
- Never persist raw vault secrets longer than necessary.

### Cloud Session

- Add later as a fallback when the desktop app is unavailable.
- Use OAuth/device-code or backend-issued access and refresh tokens.
- Store tokens in encrypted storage where possible.
- Keep clear separation between desktop session and cloud session.

### Extension Unlock State

The UI should distinguish:

```text
desktop-connected-unlocked
desktop-connected-locked
cloud-connected
offline-limited
disconnected
```

## Synchronization Architecture

The extension should treat the desktop app as the preferred local source of truth and the cloud/backend as a secondary source when available.

```text
Desktop vault/account data
  -> local bridge
  -> extension background worker
  -> encrypted browser cache
  -> popup/content/side panel UI
```

Cloud fallback:

```text
Cloud API
  -> authenticated extension session
  -> encrypted browser cache
  -> UI and content script
```

Conflict handling:

- Last-write-wins for low-risk UI preferences.
- Explicit conflict prompts for vault entries and sensitive records.
- Audit logs for sync failures and destructive actions.

## State Management Approach

Initial state should be managed through small modules:

- `sessionStore.js` for bridge/cloud/offline session status.
- `secureStore.js` for encrypted local caches.
- Popup-local UI state in the popup module.
- Background-owned sync state for bridge status, cache freshness, and last errors.

Later, migrate popup/options/side panel to React with Zustand.

## Security Considerations

- Minimize host permissions.
- Prefer `activeTab` and optional host permissions.
- Do not default to `<all_urls>` for all targets unless autofill requires a deliberate opt-in.
- Validate every runtime message.
- Validate every bridge command payload.
- Never log passwords, secret notes, tokens, or full vault records.
- Use strict Content Security Policy.
- No remote scripts.
- No inline scripts in extension pages.
- Encrypt local cache with WebCrypto before storing sensitive values.
- Use domain matching to prevent cross-site autofill leaks.
- Require a user gesture for high-risk operations.
- Redact logs and support bundles.

## Performance Optimization Strategy

- Keep background worker lightweight.
- Avoid loading full vault data into content scripts.
- Cache current-tab match results.
- Lazy-load richer UI surfaces.
- Avoid large dependencies in content scripts.
- Use debounced search.
- Keep popup first paint under 150ms where possible.
- Precompute normalized domains for vault entries.

## Build and Deployment Pipeline

Initial scripts:

```text
npm run extension:platform:build
npm run extension:platform:chrome
npm run extension:platform:firefox
```

Outputs:

```text
release/extensions/chromium-platform/
release/extensions/firefox-platform/
```

Future CI:

1. Install dependencies.
2. Run lint/unit tests.
3. Build desktop app.
4. Build browser extension targets.
5. Run browser compatibility smoke tests.
6. Package release artifacts.
7. Upload extension zips to release storage.

## Testing Strategy

### Unit Tests

- Bridge client.
- Domain matching.
- Storage encryption wrappers.
- Runtime API wrapper.
- Command validation.
- Autofill field detection.

### Integration Tests

- Popup to background messaging.
- Background to desktop bridge.
- Content script autofill flow.
- Desktop unavailable fallback.
- Locked vault handling.

### E2E Tests

- Load unpacked Chromium extension.
- Detect current-site credentials.
- Fill a login form fixture.
- Save new credential flow.
- Recover when desktop bridge stops.
- Verify Firefox package loads.

### Manual Compatibility

- Chrome stable.
- Edge stable.
- Brave.
- Arc.
- Firefox stable.
- Safari Web Extension wrapper.

## Monitoring and Diagnostics

Add redacted diagnostics:

- Desktop bridge detected.
- Desktop bridge handshake failed.
- Vault locked.
- Autofill completed.
- Autofill failed.
- Sync succeeded/failed.
- Cache encrypted/decrypted.

Never log secrets or credential payloads.

## Implementation Phases

### Phase 1: Platform Scaffold

- Add architecture document.
- Add `extensions/platform` structure.
- Add manifest templates.
- Add local build script.
- Add browser runtime abstraction.
- Add desktop bridge client.
- Add first-pass popup/content/background files.

### Phase 2: Desktop Bridge Hardening

- Add formal bridge protocol version.
- Add capabilities to `/bridge/info` and `/bridge/handshake`.
- Add stricter command validation.
- Rotate session tokens.
- Add support diagnostics endpoint.

### Phase 3: Popup MVP

- Implement premium popup shell.
- Detect desktop app.
- Search vault entries.
- Fill current-site credentials.
- Show locked/disconnected/cloud states.

### Phase 4: Content Script Autofill

- Harden field detection.
- Add domain matching.
- Avoid hidden/suspicious fields.
- Support keyboard-driven fill.
- Add save/update credential prompts.

### Phase 5: Options, Side Panel, and Onboarding

- Settings page.
- First-run onboarding.
- Browser permissions explanation.
- Side panel dashboard.
- Theme parity with desktop.

### Phase 6: Cloud and Offline Modes

- Add cloud auth.
- Add encrypted browser cache.
- Add sync queue.
- Add conflict handling.
- Add offline-limited UI.

### Phase 7: Packaging and Store Readiness

- Build Chromium package.
- Build Firefox package.
- Convert Safari package.
- Add store metadata and screenshots.
- Add CI checks and release process.

## Step-by-Step Rebuild Roadmap

1. Create this strategy document.
2. Scaffold `extensions/platform`.
3. Add shared runtime/browser wrapper.
4. Add shared desktop bridge client.
5. Add command protocol definitions.
6. Add secure storage abstraction.
7. Add domain matching utilities.
8. Add popup shell.
9. Add background service worker.
10. Add content script.
11. Add Chromium manifest.
12. Add Firefox manifest.
13. Add build script to copy platform files to `release/extensions`.
14. Add package scripts.
15. Validate generated manifests.
16. Load the Chromium output unpacked in Chrome.
17. Verify desktop bridge discovery.
18. Verify vault locked/unlocked UI.
19. Verify current-site matching.
20. Verify autofill on a local test page.
21. Add options page.
22. Add side panel where supported.
23. Add cloud fallback.
24. Add encrypted cache.
25. Add tests and CI packaging.

## Current Recommendation

Use the rebuilt `extensions/platform` implementation as the active browser extension. The old `extensions/chrome` and `extensions/firefox` folders have been discarded so local testing and packaging use the generated `release/extensions/chromium-platform` and `release/extensions/firefox-platform` outputs.
