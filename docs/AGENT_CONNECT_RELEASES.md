# Agent Connect release binaries (macOS and Android)

The spawn page and download routes serve Agent Connect binaries from the Next.js app. Store both the macOS app and the Android APK in one place so downloads work without external hosting.

## Where to store the files

- **Directory:** `public/agent-connect/releases/`
- **Filenames:**
  - **macOS:** `Agent-Connect-0.1.0.dmg`
  - **Android:** `Agent-Connect-0.1.0.apk`

These filenames are allowlisted in the API route; do not commit the binaries (they are large). Add them at build or release time.

## How to add the files

1. **macOS:** Build the desktop app (e.g. `npm run dist:mac` in `packages/agent-connect`). Copy the output (e.g. `release/Agent Connect-0.1.0-arm64.dmg`) to `public/agent-connect/releases/Agent-Connect-0.1.0.dmg`.

2. **Android:** Build the APK (e.g. in `packages/agent-connect-android`). Copy the release APK (e.g. `app/build/outputs/apk/release/app-release-unsigned.apk` or signed `app-release.apk`) to `public/agent-connect/releases/Agent-Connect-0.1.0.apk`.

## Optional: external hosting (env overrides)

To serve binaries from a CDN or external host instead of the app:

- **Mac:** Set `NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL` to the full URL of your Mac download page or .dmg. The `/agent-connect/releases/latest` page will redirect there.
- **Android:** Set `NEXT_PUBLIC_AGENT_CONNECT_ANDROID_DOWNLOAD_URL` to the full URL of the .apk. The spawn page will use this for the Android download link.

If these are unset, the app serves files from `public/agent-connect/releases/` at `/agent-connect/releases/Agent-Connect-0.1.0.dmg` and `/agent-connect/releases/Agent-Connect-0.1.0.apk`.
