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
const bundle_1 = require("./bundle");
if (process.env.AGENT_CONNECT_MINIMAL === "1") {
    require("./main-minimal.js");
}
else {
    let mainWindow = null;
    let sshClient = null;
    let sshStream = null;
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
    electron_1.app.whenReady().then(() => {
        createWindow();
        const bundlePath = process.argv.find((a) => a.endsWith(".opencaw"));
        if (bundlePath) {
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
    });
    /** Normalize PEM string so ssh2 accepts it (trim, fix line endings). */
    function normalizePrivateKey(pem) {
        return pem.replace(/\r\n/g, "\n").trim();
    }
    function connectWithBundle(bundle) {
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
            client.shell((err, stream) => {
                if (err) {
                    sendToRenderer("ssh-error", err.message);
                    return;
                }
                if (!stream)
                    return;
                sshStream = stream;
                stream.on("data", (data) => sendToRenderer("ssh-data", data.toString("utf8")));
                if (stream.stderr)
                    stream.stderr.on("data", (data) => sendToRenderer("ssh-data", data.toString("utf8")));
                stream.on("close", () => sendToRenderer("ssh-close"));
            });
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
            filters: [{ name: "Agent connection", extensions: ["opencaw", "json"] }],
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
    electron_1.ipcMain.handle("connect", async (_event, bundle) => {
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
                client.shell((err, stream) => {
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
                    stream.on("data", (data) => sendToRenderer("ssh-data", data.toString("utf8")));
                    stream.stderr.on("data", (data) => sendToRenderer("ssh-data", data.toString("utf8")));
                    stream.on("close", () => sendToRenderer("ssh-close"));
                    resolve({ ok: true });
                });
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
