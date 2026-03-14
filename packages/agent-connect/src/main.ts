/// <reference path="./ssh2.d.ts" />
/// <reference path="./electron.d.ts" />
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import type { Client } from "ssh2";
import { AgentConnectionBundle, parseBundle } from "./bundle";

if (process.env.AGENT_CONNECT_MINIMAL === "1") {
  require("./main-minimal.js");
} else {
let mainWindow: BrowserWindow | null = null;
let sshClient: Client | null = null;
let sshStream: { write: (d: string) => void; setWindow?: (r: number, c: number, h: number, w: number) => void } | null = null;

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

app.whenReady().then(() => {
  createWindow();
  const bundlePath = process.argv.find((a) => a.endsWith(".opencaw"));
  if (bundlePath) {
    setImmediate(() => {
      try {
        const json = fs.readFileSync(bundlePath, "utf8");
        connectWithBundle(parseBundle(json));
      } catch (e) {
        sendToRenderer("ssh-error", e instanceof Error ? e.message : "Failed to load bundle");
      }
    });
  }
});

/** Normalize PEM string so ssh2 accepts it (trim, fix line endings). */
function normalizePrivateKey(pem: string): string {
  return pem.replace(/\r\n/g, "\n").trim();
}

function connectWithBundle(bundle: AgentConnectionBundle): void {
  if (sshClient) {
    sshClient.end();
    sshClient = null;
  }
  const { Client: SSH2Client } = require("ssh2");
  const client = new SSH2Client();
  sshClient = client;
  client
      .on("ready", () => {
        sendToRenderer("ssh-connected");
        client.shell((err: Error | undefined, stream?: any) => {
          if (err) {
            sendToRenderer("ssh-error", err.message);
            return;
          }
          if (!stream) return;
          sshStream = stream;
          stream.on("data", (data: Buffer) => sendToRenderer("ssh-data", data.toString("utf8")));
          if (stream.stderr) stream.stderr.on("data", (data: Buffer) => sendToRenderer("ssh-data", data.toString("utf8")));
          stream.on("close", () => sendToRenderer("ssh-close"));
        });
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
    filters: [{ name: "Agent connection", extensions: ["opencaw", "json"] }],
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

ipcMain.handle("connect", async (_event: unknown, bundle: AgentConnectionBundle): Promise<{ ok: true } | { error: string }> => {
  const normalized = normalizePrivateKey(bundle.privateKeyPem);
  return new Promise((resolve) => {
    if (sshClient) {
      sshClient.end();
      sshClient = null;
    }
    sshStream = null;
    const { Client: SSH2Client } = require("ssh2");
    const client = new SSH2Client();
    sshClient = client;
    client
      .on("ready", () => {
        sendToRenderer("ssh-connected");
        client.shell((err: Error | undefined, stream?: { on: (e: string, fn: (d: Buffer) => void) => void; stderr: { on: (e: string, fn: (d: Buffer) => void) => void }; write: (d: string) => void; setWindow?: (r: number, c: number, h: number, w: number) => void }) => {
          if (err) {
            sendToRenderer("ssh-error", err.message);
            resolve({ error: err.message });
            return;
          }
          if (!stream) {
            resolve({ error: "No shell" });
            return;
          }
          sshStream = stream;
          stream.on("data", (data: Buffer) => sendToRenderer("ssh-data", data.toString("utf8")));
          stream.stderr.on("data", (data: Buffer) => sendToRenderer("ssh-data", data.toString("utf8")));
          stream.on("close", () => sendToRenderer("ssh-close"));
          resolve({ ok: true });
        });
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
