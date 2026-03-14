/// <reference lib="dom" />

const w = window as Window & { Terminal?: any; FitAddon?: any; agentConnect?: any };
const Terminal = w.Terminal;
const FitAddon = w.FitAddon;

let terminal: any = null;
let fitAddon: any = null;

let welcomeEl: HTMLDivElement | null = null;
let terminalContainer: HTMLDivElement | null = null;
let statusEl: HTMLSpanElement | null = null;

function setStatus(msg: string): void {
  if (statusEl) statusEl.textContent = msg;
}

function showTerminal(): void {
  if (welcomeEl) welcomeEl.style.display = "none";
  if (terminalContainer) terminalContainer.style.display = "flex";
  if (terminal && fitAddon) {
    setTimeout(() => fitAddon.fit(), 50);
  }
}

function showWelcome(): void {
  if (terminalContainer) terminalContainer.style.display = "none";
  if (welcomeEl) welcomeEl.style.display = "block";
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
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(termEl);
  }
}

function init(): void {
  welcomeEl = document.getElementById("welcome") as HTMLDivElement | null;
  terminalContainer = document.getElementById("terminal-container") as HTMLDivElement | null;
  statusEl = document.getElementById("status") as HTMLSpanElement | null;

  if (!statusEl) {
    document.body.textContent = "UI elements missing. Check the console.";
    return;
  }

  const agentConnect = w.agentConnect;
  if (!agentConnect) {
    setStatus("Preload not available");
    return;
  }

  agentConnect.onSshConnected(() => {
    setStatus("Connected");
    initTerminal();
    showTerminal();
  });
  agentConnect.onSshError((msg: string) => {
    let hint = "";
    if (msg.includes("ECONNREFUSED")) {
      hint = " The droplet may still be starting—wait 1–2 minutes and try again.";
    } else if (msg.includes("authentication methods failed")) {
      hint = " Use the connection file you downloaded when you created this droplet, or create a new droplet from the spawn page and use that connection file.";
    }
    setStatus("Error: " + msg + hint);
  });
  agentConnect.onSshClose(() => setStatus("Session closed"));
  agentConnect.onSshData((data: string) => {
    if (terminal) terminal.write(data);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
