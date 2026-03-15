"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="./electron.d.ts" />
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("agentConnect", {
    openBundle: () => electron_1.ipcRenderer.invoke("open-bundle"),
    parseBundle: (json) => electron_1.ipcRenderer.invoke("parse-bundle", json),
    connect: (bundle) => electron_1.ipcRenderer.invoke("connect", bundle),
    onSshData: (fn) => {
        const sub = (_, data) => fn(data);
        electron_1.ipcRenderer.on("ssh-data", sub);
        return () => electron_1.ipcRenderer.removeListener("ssh-data", sub);
    },
    onSshConnected: (fn) => {
        electron_1.ipcRenderer.on("ssh-connected", () => fn());
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
