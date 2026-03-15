"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="./electron.d.ts" />
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("agentConnect", {
    openBundle: () => electron_1.ipcRenderer.invoke("open-bundle"),
    parseBundle: (json) => electron_1.ipcRenderer.invoke("parse-bundle", json),
    connect: (bundle) => electron_1.ipcRenderer.invoke("connect", bundle),
    openExternalUrl: (url) => electron_1.ipcRenderer.invoke("open-external-url", url),
    skipInstallerThisDroplet: () => electron_1.ipcRenderer.invoke("skip-installer-this-droplet"),
    clearSkipInstallerThisDroplet: () => electron_1.ipcRenderer.invoke("clear-skip-installer-this-droplet"),
    reconnectRunInstaller: () => electron_1.ipcRenderer.invoke("reconnect-run-installer"),
    onSshData: (fn) => {
        const sub = (_, data) => fn(data);
        electron_1.ipcRenderer.on("ssh-data", sub);
        return () => electron_1.ipcRenderer.removeListener("ssh-data", sub);
    },
    onSshConnected: (fn) => {
        const sub = (_, meta) => fn(meta);
        electron_1.ipcRenderer.on("ssh-connected", sub);
        return () => electron_1.ipcRenderer.removeListener("ssh-connected", sub);
    },
    onSshError: (fn) => {
        electron_1.ipcRenderer.on("ssh-error", (_, msg) => fn(msg));
    },
    onSshClose: (fn) => {
        electron_1.ipcRenderer.on("ssh-close", () => fn());
    },
    sendInput: (data) => electron_1.ipcRenderer.send("ssh-input", data),
    sendResize: (cols, rows) => electron_1.ipcRenderer.send("ssh-resize", cols, rows),
});
