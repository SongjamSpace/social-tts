/// <reference lib="dom" />

const w = window as Window & { Terminal?: any; FitAddon?: any; agentConnect?: any };
const Terminal = w.Terminal;
const FitAddon = w.FitAddon;

let terminal: any = null;
let fitAddon: any = null;
let splashEl: HTMLDivElement | null = null;
let splashStatusEl: HTMLParagraphElement | null = null;
let splashErrorEl: HTMLParagraphElement | null = null;
let appEl: HTMLDivElement | null = null;
let welcomeEl: HTMLDivElement | null = null;
let terminalContainer: HTMLDivElement | null = null;
let statusEl: HTMLSpanElement | null = null;

function setSplashStatus(msg: string): void {
  if (splashStatusEl) splashStatusEl.textContent = msg;
}

function showSplashError(msg: string): void {
  if (splashErrorEl) {
    splashErrorEl.textContent = msg;
    splashErrorEl.style.display = "block";
  }
}

function hideSplashError(): void {
  if (splashErrorEl) {
    splashErrorEl.textContent = "";
    splashErrorEl.style.display = "none";
  }
}

function hideSplash(): void {
  if (splashEl) splashEl.classList.add("hidden");
}

function setStatus(msg: string): void {
  if (statusEl) statusEl.textContent = msg;
}

function showTerminal(): void {
  if (welcomeEl) welcomeEl.style.display = "none";
  if (terminalContainer) terminalContainer.style.display = "flex";
  setTimeout(() => fitAddon?.fit?.(), 80);
}

function initTerminal(): void {
  if (terminal) return;
  const termEl = document.getElementById("terminal");
  if (!termEl || !Terminal) return;
  terminal = new Terminal({
    cursorBlink: true,
    theme: { background: "#0d0d0d", foreground: "#e5e5e5" },
  });
  fitAddon = FitAddon ? new (FitAddon.FitAddon || FitAddon)() : null;
  if (fitAddon) terminal.loadAddon(fitAddon);
  terminal.open(termEl);
  terminal.onData((data: string) => {
    if (w.agentConnect) w.agentConnect.sendInput(data);
  });
  if (fitAddon) {
    const ro = new ResizeObserver(() => fitAddon.fit());
    ro.observe(termEl);
  }
}

function enterTerminal(meta: { alreadyInstalled?: boolean; skipInstallerSaved?: boolean }): void {
  hideSplash();
  if (!appEl) return;
  appEl.style.display = "flex";
  initTerminal();
  if (terminal?.clear) terminal.clear();
  showTerminal();
  if (meta.skipInstallerSaved && meta.alreadyInstalled) {
    setStatus("Installer skipped for this droplet");
  } else {
    setStatus(meta.alreadyInstalled ? "Connected (already installed)" : "Connected");
  }
}

function init(): void {
  splashEl = document.getElementById("splash") as HTMLDivElement | null;
  splashStatusEl = document.getElementById("splash-status") as HTMLParagraphElement | null;
  splashErrorEl = document.getElementById("splash-error") as HTMLParagraphElement | null;
  appEl = document.getElementById("app") as HTMLDivElement | null;
  welcomeEl = document.getElementById("welcome") as HTMLDivElement | null;
  terminalContainer = document.getElementById("terminal-container") as HTMLDivElement | null;
  statusEl = document.getElementById("status") as HTMLSpanElement | null;

  if (!splashEl || !appEl) {
    document.body.textContent = "UI elements missing.";
    return;
  }
  if (!w.agentConnect) {
    setSplashStatus("Preload not available");
    return;
  }

  appEl.style.display = "none";

  w.agentConnect.onSshConnected((meta: { alreadyInstalled?: boolean; skipInstallerSaved?: boolean }) => {
    setSplashStatus("Connected");
    enterTerminal(meta);
  });
  w.agentConnect.onSshError((msg: string) => {
    let hint = "";
    if (msg.includes("ECONNREFUSED")) hint = " Wait 1–2 minutes if the droplet just started.";
    else if (msg.includes("authentication methods failed")) hint = " Use the .droplet from this droplet.";
    showSplashError("Error: " + msg + hint);
    setSplashStatus("Connection failed");
  });
  w.agentConnect.onSshClose(() => setStatus("Session closed"));
  w.agentConnect.onSshData((data: string) => {
    if (terminal) terminal.write(data);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
