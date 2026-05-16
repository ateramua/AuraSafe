# AuraSafe Companion Store Listing

## Short Description

Secure browser companion for AuraSafe desktop vault, autofill, finance visibility, and productivity workflows.

## Full Description

AuraSafe Companion brings the AuraSafe desktop experience into the browser with a privacy-first extension for vault search, current-site suggestions, on-demand autofill, desktop bridge diagnostics, and a richer side panel dashboard.

The extension is designed to work best with the AuraSafe desktop app. When the desktop app is running, AuraSafe Companion connects through a local, session-based bridge to read vault metadata, fill credentials after a user action, and show dashboard context. When the desktop app is unavailable, the extension can show encrypted, redacted, browse-only cache metadata without storing passwords for offline autofill.

## Key Features

- Desktop app detection and secure local bridge connection.
- Current-site vault matching and on-demand autofill.
- Popup search with live desktop results or encrypted offline metadata.
- Side panel dashboard for supported Chromium browsers.
- Settings and diagnostics for bridge status, permissions, and offline cache state.
- Minimal permission model with active-tab autofill injection.
- Light and dark theme support through shared design tokens.

## Privacy Summary

AuraSafe Companion does not inject autofill scripts into every page by default. Autofill helpers are injected only after a user clicks Fill for the active tab. Offline cache stores redacted metadata only and does not store passwords for offline fill.

## Review Notes

- Requires AuraSafe desktop app for full vault and finance functionality.
- Local bridge uses loopback HTTP on `127.0.0.1` / `localhost`.
- Firefox build does not include Chromium side panel support.
- Safari support is planned through a Safari Web Extension wrapper.
