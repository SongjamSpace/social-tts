/**
 * Minimal Electron entry point for debugging SIGTRAP.
 * Run with: AGENT_CONNECT_MINIMAL=1 npm start
 * If this opens a window, the crash is in our main/preload/loadFile path.
 */
const { app, BrowserWindow } = require("electron");

app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 800, height: 600 });
  w.loadURL("about:blank");
});
