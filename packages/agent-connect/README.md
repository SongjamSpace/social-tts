# Agent Connect

Desktop app to connect to your agent droplet via SSH. Import a `.opencaw` connection file (downloaded from the spawn success page) and connect with one click.

## Development

```bash
npm install
npm run build
npm start
```

## Build for distribution (Mac)

```bash
npm run dist:mac
```

Output: `release/Agent Connect-0.1.0-arm64.dmg` (and .zip). Host the .dmg on your site or CDN and link from the spawn success page (e.g. `/agent-connect/releases/latest`).

## If macOS says the app is "damaged"

The app is not code-signed. After downloading, macOS may show **"Agent Connect.app is damaged and can't be opened"**. This is usually Gatekeeper blocking an unsigned app. Fix it in either way:

- **Terminal:** Remove the quarantine attribute, then open the app as usual:
  ```bash
  xattr -cr "/Applications/Agent Connect.app"
  ```
- **Finder:** Right-click the app → **Open** → **Open** in the dialog. You only need to do this once.

## Usage

1. On the spawn success page, click **Download connection file** to get a `.opencaw` file.
2. Open Agent Connect and click **Import connection file**, or run from the terminal: `open "Agent Connect.app" /path/to/file.opencaw`
3. Click **Connect** (or the app connects automatically if opened with a file).

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
