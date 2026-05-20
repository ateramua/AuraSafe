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
