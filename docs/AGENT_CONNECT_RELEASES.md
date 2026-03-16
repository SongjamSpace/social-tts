# Agent Connect release binaries (macOS and Android)

The spawn page and Mac download link point to Agent Connect binaries. The **default** is [GitHub Releases](https://github.com/SongjamSpace/agent-connect/releases) so the site works as soon as you publish a release.

## GitHub Releases (default)

The website uses these URLs when env vars are not set:

- **Mac .dmg:** `https://github.com/SongjamSpace/agent-connect/releases/download/v0.1.0/Agent-Connect-0.1.0.dmg`
- **Android APK:** `https://github.com/SongjamSpace/agent-connect/releases/download/v0.1.0/app-debug.apk`

(For testing you can use `app-debug.apk`; for production you may switch to a signed release APK and update the URL or env.)

### How to create a release and upload the files

1. **Build the binaries**
   - **Mac:** In `packages/agent-connect`, run `npm run dist:mac`. Use the output DMG (e.g. `release/Agent Connect-0.1.0-arm64.dmg`).
   - **Android:** In `packages/agent-connect-android`, build the APK. For testing use `app/build/outputs/apk/debug/app-debug.apk`.

2. **Create the release on GitHub**

   **Option A – GitHub website**
   - Open https://github.com/SongjamSpace/agent-connect/releases/new
   - Tag: `v0.1.0` (must match the URLs above; create the tag if it doesn’t exist)
   - Title: e.g. `v0.1.0`
   - Description: optional
   - Upload:
     - Rename or copy your Mac DMG to **`Agent-Connect-0.1.0.dmg`** and upload it
     - Upload **`app-debug.apk`** as-is
   - Click **Publish release**

   **Option B – GitHub CLI** (if you have [gh](https://cli.github.com/) installed and authenticated)

   From the repo root (or any directory where you have the two files):

   ```bash
   gh release create v0.1.0 \
     path/to/Agent-Connect-0.1.0.dmg \
     path/to/app-debug.apk \
     --repo SongjamSpace/agent-connect \
     --title "v0.1.0"
   ```

   Or use the helper script (see below).

3. **No code or env changes needed** – the site already points at these GitHub URLs. For a different tag (e.g. `v0.2.0`), set the env overrides (see “Optional: env overrides”) or change the default URLs in code.

### Helper script (optional)

From this repo root, after building the DMG and APK:

```bash
./scripts/create-agent-connect-release.sh path/to/Agent-Connect-0.1.0.dmg path/to/app-debug.apk
```

Requires `gh` and a tag `v0.1.0` (create it in the agent-connect repo if needed).

---

## Optional: env overrides

To use a different host (e.g. another tag, or your own server):

- **Mac:** Set `NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL` to the full .dmg URL. The `/agent-connect/releases/latest` route will redirect there.
- **Android:** Set `NEXT_PUBLIC_AGENT_CONNECT_ANDROID_DOWNLOAD_URL` to the full .apk URL. The spawn page uses it for the Android download button.

---

## Self-hosted (no GitHub)

To serve from the Next.js app instead of GitHub:

- **Directory:** `public/agent-connect/releases/`
- **Filenames:** `Agent-Connect-0.1.0.dmg`, `Agent-Connect-0.1.0.apk` (or `app-debug.apk` if you add it to the allowlist in `src/app/agent-connect/releases/[file]/route.ts`)

Then set:

- `NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL` to your site’s URL for the .dmg (e.g. `https://yoursite.com/agent-connect/releases/Agent-Connect-0.1.0.dmg`)
- `NEXT_PUBLIC_AGENT_CONNECT_ANDROID_DOWNLOAD_URL` to the .apk URL

The `[file]` route only allowlists `Agent-Connect-0.1.0.dmg` and `Agent-Connect-0.1.0.apk`; for `app-debug.apk` you’d need to add it to that allowlist if you serve it from `public/`.
