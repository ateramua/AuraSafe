# AuraSafe Companion Privacy Disclosure

## Data Access

AuraSafe Companion can access the active browser tab when the user opens the popup, side panel, or clicks Fill. This is used to match the current website with AuraSafe vault entries.

## Local Desktop Bridge

When AuraSafe desktop is running, the extension communicates with a local loopback bridge on `127.0.0.1` or `localhost`. Bridge sessions are short-lived and bound to the extension origin.

## Credential Handling

Credentials are requested from the desktop app only when needed for user-initiated autofill. The extension does not store passwords for offline autofill.

## Offline Cache

The extension may store encrypted, redacted vault metadata to support browse-only offline search. Sensitive fields such as passwords, passphrases, tokens, recovery codes, OTP secrets, and notes are removed before caching.

## Logging

Extension logs are intended for diagnostics and should never contain passwords, secrets, tokens, or credential payloads.

## Remote Services

Current platform builds do not enable cloud fallback by default. Future cloud features should require explicit authentication and an updated privacy review before release.
