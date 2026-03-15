"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="./ssh2.d.ts" />
/// <reference path="./electron.d.ts" />
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const bundle_1 = require("./bundle");
if (process.env.AGENT_CONNECT_MINIMAL === "1") {
    require("./main-minimal.js");
}
else {
    let mainWindow = null;
    let sshClient = null;
    let sshStream = null;
    let pendingOpenFilePath = null;
    let currentBundleHost = null;
    let currentBundlePort = 18789;
    /** Last bundle used for connect (for skip-installer IPC). */
    let lastConnectedBundle = null;
    const OPENCLAW_INSTALL_CMD = "curl -fsSL https://openclaw.ai/install.sh | bash\n";
    const OPENCLAW_INSTALLED_PROBE = 'bash --login -c \'test -f "$HOME/.openclaw/openclaw.json" || test -x "$HOME/.openclaw/bin/openclaw" || command -v openclaw >/dev/null 2>&1 || test -d "$HOME/.openclaw/workspace" || curl -sf -m 4 http://127.0.0.1:18789/ -o /dev/null || curl -sf -m 4 http://127.0.0.1:18789 -o /dev/null\'';
    const SKIP_STORE_PATH = () => path.join(electron_1.app.getPath("userData"), "install-skip.json");
    function bundleKey(bundle) {
        return crypto
            .createHash("sha256")
            .update(`${bundle.host}:${bundle.port}:${bundle.user}:${bundle.mint ?? ""}`)
            .digest("hex")
            .slice(0, 32);
    }
    function readSkipStore() {
        try {
            const raw = fs.readFileSync(SKIP_STORE_PATH(), "utf8");
            const o = JSON.parse(raw);
            return typeof o === "object" && o ? o : {};
        }
        catch {
            return {};
        }
    }
    function writeSkipStore(store) {
        fs.mkdirSync(path.dirname(SKIP_STORE_PATH()), { recursive: true });
        fs.writeFileSync(SKIP_STORE_PATH(), JSON.stringify(store));
    }
    function getSkipInstaller(bundle) {
        return !!readSkipStore()[bundleKey(bundle)]?.skipInstaller;
    }
    function setSkipInstaller(bundle) {
        const s = readSkipStore();
        s[bundleKey(bundle)] = { skipInstaller: true, updatedAt: Date.now() };
        writeSkipStore(s);
    }
    function clearSkipInstaller(bundle) {
        const s = readSkipStore();
        delete s[bundleKey(bundle)];
        writeSkipStore(s);
    }
    function createWindow() {
        mainWindow = new electron_1.BrowserWindow({
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
    function sendToRenderer(channel, ...args) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, ...args);
        }
    }
    function isBundlePath(p) {
        return p.endsWith(".droplet") || p.endsWith(".opencaw") || p.endsWith(".json");
    }
    function loadBundleFromPathAndConnect(bundlePath) {
        setImmediate(() => {
            try {
                const json = fs.readFileSync(bundlePath, "utf8");
                connectWithBundle((0, bundle_1.parseBundle)(json));
            }
            catch (e) {
                sendToRenderer("ssh-error", e instanceof Error ? e.message : "Failed to load bundle");
            }
        });
    }
    electron_1.app.on("will-finish-launching", () => {
        electron_1.app.on("open-file", (event, pathToOpen) => {
            event.preventDefault();
            const pathNorm = pathToOpen.startsWith("file://") ? decodeURIComponent(pathToOpen.replace(/^file:\/\//, "")) : pathToOpen;
            if (!isBundlePath(pathNorm))
                return;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
                loadBundleFromPathAndConnect(pathNorm);
            }
            else {
                pendingOpenFilePath = pathNorm;
            }
        });
    });
    electron_1.app.whenReady().then(() => {
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
    function normalizePrivateKey(pem) {
        return pem.replace(/\r\n/g, "\n").trim();
    }
    /** Remote probe; true = OpenClaw signals present. Prefer ssh2 `exit`; fallback to `close` (code) if exit never fires. */
    function probeOpenClawInstalled(client) {
        return new Promise((resolve) => {
            let settled = false;
            const done = (installed) => {
                if (settled)
                    return;
                settled = true;
                resolve(installed);
            };
            const t = setTimeout(() => done(false), 25000);
            client.exec(OPENCLAW_INSTALLED_PROBE, (err, stream) => {
                if (err || !stream) {
                    clearTimeout(t);
                    done(false);
                    return;
                }
                stream.on("data", () => { });
                if (stream.stderr)
                    stream.stderr.on("data", () => { });
                stream.once("exit", (code, signal) => {
                    clearTimeout(t);
                    if (signal != null && signal !== "")
                        done(false);
                    else
                        done(code === 0);
                });
                stream.once("close", (code) => {
                    if (!settled) {
                        clearTimeout(t);
                        done(code === 0);
                    }
                });
            });
        });
    }
    function attachInteractiveShell(client, runInstaller, meta, onShellError, onShellReady) {
        client.shell((err, stream) => {
            if (err) {
                onShellError(err.message);
                return;
            }
            if (!stream) {
                onShellError("No shell");
                return;
            }
            sshStream = stream;
            stream.on("data", (data) => sendToRenderer("ssh-data", data.toString("utf8")));
            if (stream.stderr)
                stream.stderr.on("data", (data) => sendToRenderer("ssh-data", data.toString("utf8")));
            stream.on("close", () => sendToRenderer("ssh-close"));
            sendToRenderer("ssh-connected", meta);
            if (runInstaller) {
                stream.write(OPENCLAW_INSTALL_CMD);
            }
            else {
                setTimeout(() => {
                    try {
                        stream.write("openclaw\n");
                    }
                    catch {
                        /* ignore */
                    }
                }, 600);
            }
            onShellReady?.();
        });
    }
    async function decideInstallerAndConnect(client, bundle, controlUiUrl, onShellError, onShellReady) {
        lastConnectedBundle = bundle;
        const localSkip = getSkipInstaller(bundle);
        let runInstaller;
        let alreadyInstalled;
        let skipInstallerSaved = localSkip;
        if (localSkip) {
            runInstaller = false;
            alreadyInstalled = true;
        }
        else {
            const probeOk = await probeOpenClawInstalled(client);
            if (probeOk) {
                setSkipInstaller(bundle);
                skipInstallerSaved = true;
                runInstaller = false;
                alreadyInstalled = true;
            }
            else {
                runInstaller = true;
                alreadyInstalled = false;
                setSkipInstaller(bundle);
                skipInstallerSaved = true;
            }
        }
        attachInteractiveShell(client, runInstaller, { alreadyInstalled, controlUiUrl, skipInstallerSaved }, onShellError, onShellReady);
    }
    function connectWithBundle(bundle) {
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
            void decideInstallerAndConnect(client, bundle, controlUiUrl, (msg) => sendToRenderer("ssh-error", msg));
        })
            .on("error", (err) => {
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
    electron_1.app.on("window-all-closed", () => {
        if (sshClient) {
            sshClient.end();
            sshClient = null;
        }
        electron_1.app.quit();
    });
    const getWindowForDialog = () => mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    electron_1.ipcMain.handle("open-bundle", async () => {
        const win = getWindowForDialog();
        if (win) {
            win.focus();
            if (win.isMinimized())
                win.restore();
        }
        const result = await electron_1.dialog.showOpenDialog(win ?? undefined, {
            title: "Select connection file",
            filters: [{ name: "Droplet connection", extensions: ["droplet", "opencaw", "json"] }],
            properties: ["openFile"],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { error: "cancelled" };
        }
        try {
            const json = fs.readFileSync(result.filePaths[0], "utf8");
            const bundle = (0, bundle_1.parseBundle)(json);
            return { bundle };
        }
        catch (e) {
            return { error: e instanceof Error ? e.message : "Invalid bundle" };
        }
    });
    electron_1.ipcMain.handle("parse-bundle", async (_, json) => {
        try {
            const bundle = (0, bundle_1.parseBundle)(json);
            return { bundle };
        }
        catch (e) {
            return { error: e instanceof Error ? e.message : "Invalid bundle" };
        }
    });
    electron_1.ipcMain.handle("open-external-url", async (_, url) => {
        await electron_1.shell.openExternal(url);
    });
    /** Remember this droplet: never auto-run install.sh on reconnect. */
    electron_1.ipcMain.handle("skip-installer-this-droplet", async () => {
        if (!lastConnectedBundle)
            return { error: "Not connected" };
        setSkipInstaller(lastConnectedBundle);
        return { ok: true };
    });
    electron_1.ipcMain.handle("clear-skip-installer-this-droplet", async () => {
        if (!lastConnectedBundle)
            return { error: "No droplet" };
        clearSkipInstaller(lastConnectedBundle);
        return { ok: true };
    });
    /** Clear saved skip and reconnect with installer (same bundle). */
    electron_1.ipcMain.handle("reconnect-run-installer", async () => {
        const bundle = lastConnectedBundle;
        if (!bundle)
            return { error: "No droplet to reconnect" };
        clearSkipInstaller(bundle);
        if (sshClient) {
            sshClient.end();
            sshClient = null;
        }
        sshStream = null;
        connectWithBundle(bundle);
        return { ok: true };
    });
    electron_1.ipcMain.handle("connect", async (_event, bundle) => {
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
                void decideInstallerAndConnect(client, bundle, controlUiUrl, (msg) => {
                    sendToRenderer("ssh-error", msg);
                    resolve({ error: msg });
                }, () => resolve({ ok: true }));
            })
                .on("error", (err) => {
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
    electron_1.ipcMain.on("ssh-input", (_event, data) => {
        if (sshStream && typeof sshStream.write === "function") {
            sshStream.write(data);
        }
    });
    electron_1.ipcMain.on("ssh-resize", (_event, cols, rows) => {
        if (sshStream && typeof sshStream.setWindow === "function") {
            sshStream.setWindow(rows, cols, 0, 0);
        }
    });
}
