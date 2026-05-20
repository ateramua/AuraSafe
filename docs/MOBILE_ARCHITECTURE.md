# AuraSafe multi-platform architecture

This repository uses a **pnpm + Turborepo** monorepo. Desktop remains at the repository root (`electron/`, `src/`). Android lives in `apps/mobile/android-app`.

## Layout

- `apps/desktop` — Electron desktop wrapper scripts
- `apps/mobile/android-app` — React Native (Expo) Android application
- `packages/*` — Shared platform-agnostic core
- `services/*` — Orchestration services (cloud sync, AI, workspace indexing)

## Mobile development

```bash
npx pnpm install
npx pnpm run build:packages
npx pnpm run dev:mobile
```

If you see `spawn adb ENOENT`, the Android SDK is not installed. See [ANDROID_DEV_SETUP.md](./ANDROID_DEV_SETUP.md).

- **No SDK yet:** use Expo Go on a phone (scan QR from `dev:mobile`).
- **With SDK/emulator:** `npx pnpm run dev:mobile:android`

## Desktop development (unchanged)

```bash
npm run dev
```

## After merge to `main`

Both desktop and mobile live on `main`. Use short-lived feature branches for changes, then open a PR back to `main`.

| Task | Command |
|------|---------|
| Install deps | `npx pnpm install` |
| Build shared packages | `npx pnpm run build:packages` |
| Mobile (Expo Go) | `npx pnpm run dev:mobile` |
| Desktop | `npm run dev` |
| Release APK (local) | See [ANDROID_DEV_SETUP.md](./ANDROID_DEV_SETUP.md) — build artifacts are not committed |

Vault data in Expo Go does not transfer to a standalone APK; restore from a `.aura` backup on the device app.
