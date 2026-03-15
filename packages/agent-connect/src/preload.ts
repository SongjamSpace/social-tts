/// <reference path="./electron.d.ts" />
import { contextBridge, ipcRenderer } from "electron";

export type SshConnectedMeta = {
  alreadyInstalled: boolean;
  controlUiUrl: string;
  skipInstallerSaved?: boolean;
};

contextBridge.exposeInMainWorld("agentConnect", {
  openBundle: () => ipcRenderer.invoke("open-bundle"),
  parseBundle: (json: string) => ipcRenderer.invoke("parse-bundle", json),
  connect: (bundle: unknown) => ipcRenderer.invoke("connect", bundle),
  openExternalUrl: (url: string) => ipcRenderer.invoke("open-external-url", url),
  skipInstallerThisDroplet: () => ipcRenderer.invoke("skip-installer-this-droplet"),
  clearSkipInstallerThisDroplet: () => ipcRenderer.invoke("clear-skip-installer-this-droplet"),
  reconnectRunInstaller: () => ipcRenderer.invoke("reconnect-run-installer"),
  onSshData: (fn: (data: string) => void) => {
    const sub = (_: unknown, data: string) => fn(data);
    ipcRenderer.on("ssh-data", sub);
    return () => ipcRenderer.removeListener("ssh-data", sub);
  },
  onSshConnected: (fn: (meta: SshConnectedMeta) => void) => {
    const sub = (_: unknown, meta: SshConnectedMeta) => fn(meta);
    ipcRenderer.on("ssh-connected", sub);
    return () => ipcRenderer.removeListener("ssh-connected", sub);
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
