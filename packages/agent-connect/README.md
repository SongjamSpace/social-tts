# Agent Connect

Desktop app to connect to your agent droplet via SSH. Import a `.droplet` connection file (from the spawn success page) and connect with one click.

**Reconnect / skip installer**

- **First open:** The first time you open a given `.droplet`, the app runs the OpenClaw installer (`curl … install.sh`). It **automatically** saves “skip installer for this droplet” so you do **not** need to click anything.
- **Every later open:** Reopening the same `.droplet` skips the installer: you get a shell and an automatic `openclaw` line. No button required.
- **Run installer again:** Use the toolbar/banner **Run installer again** to clear the saved preference and reconnect with the full installer (e.g. after wiping the VM).
- Each new SSH session is a new terminal; scrollback is not restored. For continuity use **Open Control UI** (browser) or **tmux** on the server.
- Skip state is stored in `install-skip.json` under the app’s userData (macOS app support).

## Development

```bash
npm install
npm run build
npm start
```

## Build for distribution (Mac)

**Rebuild and reinstall:** After pulling changes (e.g. skip-installer logic or UI), run a full build and reinstall the app so the bundled UI and logic are up to date:

```bash
cd packages/agent-connect && npm run build && npm run dist:mac
```

Then install the new .app from `release/` (e.g. drag `Agent Connect.app` to Applications from the DMG). Old builds do not include the latest behavior.

Output: `release/Agent Connect-0.1.0-arm64.dmg` (and .zip). Host the .dmg on your site or CDN and link from the spawn success page (e.g. `/agent-connect/releases/latest`).

## If macOS says the app is "damaged"

The app is not code-signed. After downloading, macOS may show **"Agent Connect.app is damaged and can't be opened"**. This is usually Gatekeeper blocking an unsigned app. Fix it in either way:

- **Terminal:** Remove the quarantine attribute, then open the app as usual:
  ```bash
  xattr -cr "/Applications/Agent Connect.app"
  ```
- **Finder:** Right-click the app → **Open** → **Open** in the dialog. You only need to do this once.

## Usage

1. On the spawn success page, download the **`.droplet`** connection file.
2. Double-click the `.droplet` (or import from the app). The **first** time you open it, the app runs the OpenClaw installer and saves “skip next time” for that droplet.
3. Every **later** open of the same `.droplet` skips the installer and goes straight to a shell. Use **Run installer again** in the app only if you wiped the VM or need a fresh install.

## Testing

### From source (recommended first)

1. `cd packages/agent-connect && npm install && npm run build && npm start`
2. Window should open with toolbar ("Import connection file", "Connect") and status "Import a .opencaw file to connect". You should not see "Preload not available".
3. Use a real `.opencaw` from the spawn success page (after a successful droplet spawn), or a minimal test file: `{"version":1,"host":"<ip>","port":22,"user":"root","privateKeyPem":"-----BEGIN OPENSSH PRIVATE KEY-----\\n...\\n-----END OPENSSH PRIVATE KEY-----"}` saved as `.opencaw`.
4. **Connection refused:** If you see `connect ECONNREFUSED <ip>:22`, the droplet is likely still booting (cloud-init runs first). Wait 1–2 minutes after the spawn page shows the IP, then click Connect again.
5. Click **Import connection file**, select the file, then **Connect**. Expect either "Connected" and a terminal, or a clear error (e.g. connection refused, auth failed).

### Built app (DMG)

1. Build: `npm run dist:mac`. Output: `release/Agent Connect-0.1.0-arm64.dmg`.
2. Copy the DMG to `public/agent-connect/releases/` as `Agent-Connect-0.1.0.dmg` so the web download page can serve it.
3. Install (e.g. drag to Applications). If macOS says "damaged", run: `xattr -cr "/Applications/Agent Connect.app"` or right-click → Open.
4. Open Agent Connect, import the same `.opencaw` as above, click Connect. Same expectations as from source.

## Debug log file (when debugging with Cursor)

When Agent Connect is run with debug instrumentation, logs are written to a file in the **project root** (the `social-tts` folder), not inside `packages/agent-connect`:

- **Path:** `.cursor/debug-330dc7.log` (the number is the session ID; yours may differ, e.g. `debug-abc123.log`).
- **Full path on your machine:** `social-tts/.cursor/debug-330dc7.log` — e.g. `/Users/<you>/social-tts/.cursor/debug-330dc7.log`.
- **In Cursor:** Press **Cmd+P** (Quick Open), type `debug` or `.cursor/debug`, and open the file that matches.
- **In Finder:** Open your project folder (`social-tts`). If you don’t see `.cursor`, show hidden files (**Cmd+Shift+.**). Open the `.cursor` folder and look for `debug-*.log`.
- **In Terminal:** `cat /Users/<you>/social-tts/.cursor/debug-330dc7.log` (replace `<you>` with your username and the filename with your session’s file).
