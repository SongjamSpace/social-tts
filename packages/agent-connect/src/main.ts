/// <reference path="./ssh2.d.ts" />
/// <reference path="./electron.d.ts" />
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import type { Client } from "ssh2";
import { AgentConnectionBundle, parseBundle } from "./bundle";

if (process.env.AGENT_CONNECT_MINIMAL === "1") {
  require("./main-minimal.js");
} else {
let mainWindow: BrowserWindow | null = null;
let sshClient: Client | null = null;
let sshStream: { write: (d: string) => void; setWindow?: (r: number, c: number, h: number, w: number) => void } | null = null;

let pendingOpenFilePath: string | null = null;
let currentBundleHost: string | null = null;
let currentBundlePort: number = 18789;
/** Last bundle used for connect (for skip-installer IPC). */
let lastConnectedBundle: AgentConnectionBundle | null = null;

const OPENCLAW_INSTALL_CMD = "curl -fsSL https://openclaw.ai/install.sh | bash\n";
const OPENCLAW_INSTALLED_PROBE =
  'bash --login -c \'test -f "$HOME/.openclaw/openclaw.json" || test -x "$HOME/.openclaw/bin/openclaw" || command -v openclaw >/dev/null 2>&1 || test -d "$HOME/.openclaw/workspace" || curl -sf -m 4 http://127.0.0.1:18789/ -o /dev/null || curl -sf -m 4 http://127.0.0.1:18789 -o /dev/null\'';

const SKIP_STORE_PATH = () => path.join(app.getPath("userData"), "install-skip.json");

function bundleKey(bundle: AgentConnectionBundle): string {
  return crypto
    .createHash("sha256")
    .update(`${bundle.host}:${bundle.port}:${bundle.user}:${bundle.mint ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

type SkipEntry = { skipInstaller: boolean; updatedAt: number };

function readSkipStore(): Record<string, SkipEntry> {
  try {
    const raw = fs.readFileSync(SKIP_STORE_PATH(), "utf8");
    const o = JSON.parse(raw) as Record<string, SkipEntry>;
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

function writeSkipStore(store: Record<string, SkipEntry>): void {
  fs.mkdirSync(path.dirname(SKIP_STORE_PATH()), { recursive: true });
  fs.writeFileSync(SKIP_STORE_PATH(), JSON.stringify(store));
}

function getSkipInstaller(bundle: AgentConnectionBundle): boolean {
  return !!readSkipStore()[bundleKey(bundle)]?.skipInstaller;
}

function setSkipInstaller(bundle: AgentConnectionBundle): void {
  const s = readSkipStore();
  s[bundleKey(bundle)] = { skipInstaller: true, updatedAt: Date.now() };
  writeSkipStore(s);
}

function clearSkipInstaller(bundle: AgentConnectionBundle): void {
  const s = readSkipStore();
  delete s[bundleKey(bundle)];
  writeSkipStore(s);
}

type SshConnectedMeta = {
  alreadyInstalled: boolean;
  controlUiUrl: string;
  skipInstallerSaved: boolean;
};

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Agent Connect",
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
    sshStream = null;
    if (sshClient) {
      sshClient.end();
      sshClient = null;
    }
  });
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function isBundlePath(p: string): boolean {
  return p.endsWith(".droplet") || p.endsWith(".opencaw") || p.endsWith(".json");
}

function loadBundleFromPathAndConnect(bundlePath: string): void {
  setImmediate(() => {
    try {
      const json = fs.readFileSync(bundlePath, "utf8");
      connectWithBundle(parseBundle(json));
    } catch (e) {
      sendToRenderer("ssh-error", e instanceof Error ? e.message : "Failed to load bundle");
    }
  });
}

app.on("will-finish-launching", () => {
  app.on("open-file", (event, pathToOpen) => {
    event.preventDefault();
    const pathNorm = pathToOpen.startsWith("file://") ? decodeURIComponent(pathToOpen.replace(/^file:\/\//, "")) : pathToOpen;
    if (!isBundlePath(pathNorm)) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      loadBundleFromPathAndConnect(pathNorm);
    } else {
      pendingOpenFilePath = pathNorm;
    }
  });
});

app.whenReady().then(() => {
  createWindow();
  const bundlePath = process.argv.find((a) => isBundlePath(a)) ?? pendingOpenFilePath;
  if (bundlePath) {
    pendingOpenFilePath = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
    loadBundleFromPathAndConnect(bundlePath);
  }
});

function normalizePrivateKey(pem: string): string {
  return pem.replace(/\r\n/g, "\n").trim();
}

/** Remote probe; true = OpenClaw signals present. Prefer ssh2 `exit`; fallback to `close` (code) if exit never fires. */
function probeOpenClawInstalled(client: any): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (installed: boolean) => {
      if (settled) return;
      settled = true;
      resolve(installed);
    };
    const t = setTimeout(() => done(false), 25000);
    client.exec(OPENCLAW_INSTALLED_PROBE, (err: Error | undefined, stream?: any) => {
      if (err || !stream) {
        clearTimeout(t);
        done(false);
        return;
      }
      stream.on("data", () => {});
      if (stream.stderr) stream.stderr.on("data", () => {});
      stream.once("exit", (code: number | null | undefined, signal?: string) => {
        clearTimeout(t);
        if (signal != null && signal !== "") done(false);
        else done(code === 0);
      });
      stream.once("close", (code?: number | null) => {
        if (!settled) {
          clearTimeout(t);
          done(code === 0);
        }
      });
    });
  });
}

type ShellStream = {
  on: (e: string, fn: (...args: any[]) => void) => void;
  stderr?: { on: (e: string, fn: (d: Buffer) => void) => void };
  write: (d: string) => void;
  setWindow?: (r: number, c: number, h: number, w: number) => void;
};

function attachInteractiveShell(
  client: any,
  runInstaller: boolean,
  meta: SshConnectedMeta,
  onShellError: (msg: string) => void,
  onShellReady?: () => void
): void {
  client.shell((err: Error | undefined, stream?: ShellStream) => {
    if (err) {
      onShellError(err.message);
      return;
    }
    if (!stream) {
      onShellError("No shell");
      return;
    }
    sshStream = stream;
    stream.on("data", (data: Buffer) => sendToRenderer("ssh-data", data.toString("utf8")));
    if (stream.stderr) stream.stderr.on("data", (data: Buffer) => sendToRenderer("ssh-data", data.toString("utf8")));
    stream.on("close", () => sendToRenderer("ssh-close"));
    sendToRenderer("ssh-connected", meta);
    if (runInstaller) {
      stream.write(OPENCLAW_INSTALL_CMD);
    } else {
      setTimeout(() => {
        try {
          stream.write("openclaw\n");
        } catch {
          /* ignore */
        }
      }, 600);
    }
    onShellReady?.();
  });
}

async function decideInstallerAndConnect(
  client: any,
  bundle: AgentConnectionBundle,
  controlUiUrl: string,
  onShellError: (msg: string) => void,
  onShellReady?: () => void
): Promise<void> {
  lastConnectedBundle = bundle;
  const localSkip = getSkipInstaller(bundle);
  let runInstaller: boolean;
  let alreadyInstalled: boolean;
  let skipInstallerSaved = localSkip;

  if (localSkip) {
    runInstaller = false;
    alreadyInstalled = true;
  } else {
    const probeOk = await probeOpenClawInstalled(client);
    if (probeOk) {
      setSkipInstaller(bundle);
      skipInstallerSaved = true;
      runInstaller = false;
      alreadyInstalled = true;
    } else {
      runInstaller = true;
      alreadyInstalled = false;
      setSkipInstaller(bundle);
      skipInstallerSaved = true;
    }
  }

  attachInteractiveShell(
    client,
    runInstaller,
    { alreadyInstalled, controlUiUrl, skipInstallerSaved },
    onShellError,
    onShellReady
  );
}

function connectWithBundle(bundle: AgentConnectionBundle): void {
  if (sshClient) {
    sshClient.end();
    sshClient = null;
  }
  currentBundleHost = bundle.host;
  currentBundlePort = 18789;
  const { Client: SSH2Client } = require("ssh2");
  const client = new SSH2Client();
  sshClient = client;
  const controlUiUrl = `http://${bundle.host}:18789`;
  client
    .on("ready", () => {
      void decideInstallerAndConnect(
        client,
        bundle,
        controlUiUrl,
        (msg) => sendToRenderer("ssh-error", msg)
      );
    })
    .on("error", (err: Error) => {
      sendToRenderer("ssh-error", err.message);
      sshClient = null;
    })
    .connect({
      host: bundle.host,
      port: bundle.port,
      username: bundle.user,
      privateKey: normalizePrivateKey(bundle.privateKeyPem),
      tryKeyboard: false,
      readyTimeout: 60000,
    });
}

app.on("window-all-closed", () => {
  if (sshClient) {
    sshClient.end();
    sshClient = null;
  }
  app.quit();
});

const getWindowForDialog = (): BrowserWindow | null =>
  mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;

ipcMain.handle("open-bundle", async (): Promise<{ bundle: AgentConnectionBundle } | { error: string }> => {
  const win = getWindowForDialog();
  if (win) {
    win.focus();
    if (win.isMinimized()) win.restore();
  }
  const result = await dialog.showOpenDialog(win ?? (undefined as any), {
    title: "Select connection file",
    filters: [{ name: "Droplet connection", extensions: ["droplet", "opencaw", "json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { error: "cancelled" };
  }
  try {
    const json = fs.readFileSync(result.filePaths[0], "utf8");
    const bundle = parseBundle(json);
    return { bundle };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid bundle" };
  }
});

ipcMain.handle("parse-bundle", async (_: unknown, json: string): Promise<{ bundle: AgentConnectionBundle } | { error: string }> => {
  try {
    const bundle = parseBundle(json);
    return { bundle };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid bundle" };
  }
});

ipcMain.handle("open-external-url", async (_: unknown, url: string): Promise<void> => {
  await shell.openExternal(url);
});

/** Remember this droplet: never auto-run install.sh on reconnect. */
ipcMain.handle("skip-installer-this-droplet", async (): Promise<{ ok: true } | { error: string }> => {
  if (!lastConnectedBundle) return { error: "Not connected" };
  setSkipInstaller(lastConnectedBundle);
  return { ok: true };
});

ipcMain.handle("clear-skip-installer-this-droplet", async (): Promise<{ ok: true } | { error: string }> => {
  if (!lastConnectedBundle) return { error: "No droplet" };
  clearSkipInstaller(lastConnectedBundle);
  return { ok: true };
});

/** Clear saved skip and reconnect with installer (same bundle). */
ipcMain.handle("reconnect-run-installer", async (): Promise<{ ok: true } | { error: string }> => {
  const bundle = lastConnectedBundle;
  if (!bundle) return { error: "No droplet to reconnect" };
  clearSkipInstaller(bundle);
  if (sshClient) {
    sshClient.end();
    sshClient = null;
  }
  sshStream = null;
  connectWithBundle(bundle);
  return { ok: true };
});

ipcMain.handle("connect", async (_event: unknown, bundle: AgentConnectionBundle): Promise<{ ok: true } | { error: string }> => {
  const normalized = normalizePrivateKey(bundle.privateKeyPem);
  const controlUiUrl = `http://${bundle.host}:18789`;
  return new Promise((resolve) => {
    if (sshClient) {
      sshClient.end();
      sshClient = null;
    }
    sshStream = null;
    currentBundleHost = bundle.host;
    currentBundlePort = 18789;
    const { Client: SSH2Client } = require("ssh2");
    const client = new SSH2Client();
    sshClient = client;
    client
      .on("ready", () => {
        void decideInstallerAndConnect(
          client,
          bundle,
          controlUiUrl,
          (msg) => {
            sendToRenderer("ssh-error", msg);
            resolve({ error: msg });
          },
          () => resolve({ ok: true })
        );
      })
      .on("error", (err: Error) => {
        sendToRenderer("ssh-error", err.message);
        resolve({ error: err.message });
        sshClient = null;
      })
      .connect({
        host: bundle.host,
        port: bundle.port,
        username: bundle.user,
        privateKey: normalized,
        tryKeyboard: false,
        readyTimeout: 60000,
      });
  });
});

ipcMain.on("ssh-input", (_event: unknown, data: string) => {
  if (sshStream && typeof sshStream.write === "function") {
    sshStream.write(data);
  }
});

ipcMain.on("ssh-resize", (_event: unknown, cols: number, rows: number) => {
  if (sshStream && typeof sshStream.setWindow === "function") {
    sshStream.setWindow(rows, cols, 0, 0);
  }
});

}
