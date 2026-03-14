declare module "electron" {
  export const app: any;
  export const dialog: any;
  export const ipcMain: {
    handle(channel: string, listener: (event: unknown, ...args: any[]) => any): void;
    on(channel: string, listener: (event: unknown, ...args: any[]) => void): void;
  };
  export const ipcRenderer: any;
  export const contextBridge: { exposeInMainWorld(apiKey: string, api: object): void };
  export class BrowserWindow {
    constructor(options: any);
    loadFile(path: string): void;
    webContents: any;
    on(event: string, fn: () => void): void;
    isDestroyed(): boolean;
  }
}
