#!/usr/bin/env bash
set -euo pipefail

# Extension icons only (16, 32, 48, 128). Desktop app icons stay empty so
# electron-builder uses the default Electron icon, same as before the blue icon.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/electron/assets"
EXT_ICONS="$ROOT/extensions/platform/icons"
TMP="$ROOT/.icon-build"

rm -rf "$TMP"
mkdir -p "$TMP" "$ASSETS" "$EXT_ICONS"

# Draw at 128×128 — native size for extension icon set
swift "$ROOT/scripts/generate-app-icon.swift" "$TMP/icon-128.png" 128

sips -z 16 16   "$TMP/icon-128.png" --out "$EXT_ICONS/icon16.png" >/dev/null
sips -z 32 32   "$TMP/icon-128.png" --out "$EXT_ICONS/icon32.png" >/dev/null
sips -z 48 48   "$TMP/icon-128.png" --out "$EXT_ICONS/icon48.png" >/dev/null
cp "$TMP/icon-128.png" "$EXT_ICONS/icon128.png"

# Desktop: no custom icon files (0 bytes) — default Electron icon in Dock/Applications
: >"$ASSETS/icon.png"
: >"$ASSETS/icon.icns"
rm -f "$ASSETS/icon-64.png"

rm -rf "$TMP"
echo "Extension icons updated (blue AuraSafe, 16/32/48/128 px):"
echo "  $EXT_ICONS/icon16.png"
echo "  $EXT_ICONS/icon32.png"
echo "  $EXT_ICONS/icon48.png"
echo "  $EXT_ICONS/icon128.png"
echo "Desktop icons cleared (empty — uses default Electron icon):"
echo "  $ASSETS/icon.png"
echo "  $ASSETS/icon.icns"
