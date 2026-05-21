# Android development setup (AuraSafe mobile)

Your build succeeded. The error `spawn adb ENOENT` means the **Android SDK is not installed** (or `ANDROID_HOME` is not set). The AuraSafe app code is fine.

## Restore from desktop backup (onboarding)

On first launch you should see **Get started** with a large **Restore from .aura backup** card (not only “Create vault”). The phone cannot read files directly from your Mac—you must copy the `.aura` file onto the phone first (see below). If encrypted, enter the **backup password** (export password—not your new master password). Then set your **new** master password and tap **Create vault**.

### Getting a desktop `.aura` file onto the phone

1. On Mac (AuraSafe desktop): export backup → note path (e.g. `Documents/AuraSafe Backups/…aura`).
2. Transfer to Android, any one of:
   - **Google Drive / Dropbox**: upload on Mac, open same account in the file picker on the phone.
   - **Email**: attach `.aura` to yourself, open attachment on the phone, save to Downloads, then pick in AuraSafe.
   - **USB**: connect phone, copy file into `Download` folder.
3. In AuraSafe mobile: **Choose .aura backup file** → browse **Downloads**, **Drive**, or **Files**.

If you still see only the old create screen, reload the app bundle (see troubleshooting below).

## Expo Go SDK version

This project targets **Expo SDK 54** (matches the current Play Store Expo Go app). If you see an SDK mismatch error, pull the latest code and run `npx pnpm install` again.

## Option A — Expo Go on a physical Android phone (fastest, no SDK)

1. Install **Expo Go** from the Play Store on your phone.
2. From the repo root:

```bash
npx pnpm run dev:mobile
```

3. Scan the QR code in the terminal with Expo Go (same Wi‑Fi as your Mac).
4. Do **not** press `a` in the terminal until the SDK is installed.

## Option B — Android emulator (requires SDK)

### 1. Install Android Studio

Download [Android Studio](https://developer.android.com/studio) and install it with:

- Android SDK
- Android SDK Platform-Tools (includes `adb`)
- At least one system image (e.g. Pixel 6 / API 34)

### 2. Set environment variables

Add to `~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
```

Then:

```bash
source ~/.zshrc
adb version   # should print a version, not "command not found"
```

### 3. Create and start an emulator

In Android Studio: **Device Manager** → Create Virtual Device → Start.

Or from terminal:

```bash
emulator -list_avds
emulator -avd <your_avd_name>
```

### 4. Run AuraSafe on the emulator

```bash
cd "/Users/abditeramu/Documents/repos/aurasafe-repo/AuraSafe"
npx pnpm run dev:mobile:android
```

Or start Metro only, then press `a`:

```bash
npx pnpm run dev:mobile
# when Metro is running, press a
```

## Onboarding UI looks old (no “Restore from backup”)

Expo Go often keeps an **old JavaScript bundle**. After pulling mobile restore changes:

1. Stop Metro (Ctrl+C).
2. From repo root:

```bash
npx pnpm install
npx pnpm run build:packages
npx pnpm run dev:mobile:clear
```

3. On the phone: force-quit **Expo Go**, reopen, scan the QR code again.
4. In Expo Go, shake the device → **Reload**.

You should see **Get started** with a blue **Restore from .aura backup** card. If you already created a vault on the device, clear that project in Expo Go or reset app storage so onboarding runs again.

## `Failed to download remote update` (Expo Go on Android)

Expo Go could not download the JS bundle from your Mac. The app code is usually fine; this is a **network path** issue between phone and Metro.

### Fix (try in order)

1. **Keep Metro running** — do not stop the terminal before the phone finishes loading. Wait until you see `Bundled` or no errors in the Metro log after scanning.

2. **Same Wi‑Fi** — phone and Mac on the same network (not guest Wi‑Fi, not phone cellular only). Turn off **VPN** on both devices.

3. **Tunnel mode** (works when LAN is blocked):

```bash
npx pnpm run dev:mobile:tunnel
```

Scan the new QR code. First run may install `@expo/ngrok`; allow it. Tunnel is slower but avoids router/firewall blocking port 8081.

4. **Clear Expo Go** — force-quit Expo Go → open again → remove old AuraSafe project if listed → scan fresh QR.

5. **Mac firewall** — System Settings → Network → Firewall: allow incoming connections for **Node** / terminal, or turn firewall off briefly to test.

6. **Manual URL** — in Expo Go, “Enter URL manually” and paste the `exp://…` URL from the terminal (not an old screenshot).

7. **Expo Go version** — must support **SDK 54** (update from Play Store).

If Metro shows a red **500** or **Unable to resolve** error when you scan, fix that bundler error first (see below); Android often reports it as “Failed to download remote update”.

## Metro 500 / `Unable to resolve expo-modules-core`

Usually pnpm + Metro could not see Expo’s native modules. Fix:

```bash
npx pnpm install
npx pnpm run dev:mobile:clear
```

The repo uses `.npmrc` `public-hoist-pattern` for Expo/React Native and lists `expo-modules-core` on the mobile app. If it persists, delete `node_modules` and reinstall:

```bash
rm -rf node_modules apps/mobile/android-app/node_modules
npx pnpm install
```

## Metro 500 / "Unable to resolve whatwg-fetch"

If Expo Go shows a **500** error mentioning `whatwg-fetch`:

1. Pull latest code (includes `whatwg-fetch` + Metro fix).
2. From repo root:

```bash
npx pnpm install
npx pnpm run dev:mobile -- --clear
```

The `--clear` flag resets Metro cache (important after dependency changes).

## Fix Expo version warnings (optional)

From `apps/mobile/android-app`:

```bash
npx expo install @expo/vector-icons react-native
```

## Scripts reference

| Command | What it does |
|---------|----------------|
| `pnpm run dev:mobile` | Build packages + start Metro (QR / manual `a`) |
| `pnpm run dev:mobile:android` | Same, then auto-launch on emulator (needs SDK) |
| `cd apps/mobile/android-app && pnpm run android` | Native build + install (needs SDK) |
