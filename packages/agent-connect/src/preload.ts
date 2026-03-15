/// <reference path="./electron.d.ts" />
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentConnect", {
  openBundle: () => ipcRenderer.invoke("open-bundle"),
  parseBundle: (json: string) => ipcRenderer.invoke("parse-bundle", json),
  connect: (bundle: unknown) => ipcRenderer.invoke("connect", bundle),
  onSshData: (fn: (data: string) => void) => {
    const sub = (_: unknown, data: string) => fn(data);
    ipcRenderer.on("ssh-data", sub);
    return () => ipcRenderer.removeListener("ssh-data", sub);
  },
  onSshConnected: (fn: () => void) => {
    ipcRenderer.on("ssh-connected", () => fn());
  },
  onSshError: (fn: (msg: string) => void) => {
    ipcRenderer.on("ssh-error", (_: unknown, msg: string) => fn(msg));
  },
  onSshClose: (fn: () => void) => {
    ipcRenderer.on("ssh-close", () => fn());
  },
  sendInput: (data: string) => ipcRenderer.send("ssh-input", data),
  sendResize: (cols: number, rows: number) => ipcRenderer.send("ssh-resize", cols, rows),
});
