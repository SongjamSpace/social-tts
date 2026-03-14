/// <reference lib="dom" />

const w = window as Window & { Terminal?: any; FitAddon?: any; agentConnect?: any };
const Terminal = w.Terminal;
const FitAddon = w.FitAddon;

let terminal: any = null;
let fitAddon: any = null;
let currentBundle: unknown = null;

let welcomeEl: HTMLDivElement | null = null;
let terminalContainer: HTMLDivElement | null = null;
let statusEl: HTMLSpanElement | null = null;
let btnOpen: HTMLButtonElement | null = null;
let btnConnect: HTMLButtonElement | null = null;
let fileInput: HTMLInputElement | null = null;

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

function loadBundleFromJson(agentConnect: any, json: string): void {
  agentConnect.parseBundle(json).then((result: { bundle?: unknown; error?: string }) => {
    if ("error" in result && result.error) {
      setStatus(result.error);
      return;
    }
    if ("bundle" in result && result.bundle) {
      currentBundle = result.bundle;
      if (btnConnect) btnConnect.disabled = false;
      setStatus("Ready to connect to " + (result.bundle as any).host);
    }
  }).catch((e: Error) => setStatus("Error: " + (e && e.message ? e.message : "Invalid file")));
}

function init(): void {
  welcomeEl = document.getElementById("welcome") as HTMLDivElement | null;
  terminalContainer = document.getElementById("terminal-container") as HTMLDivElement | null;
  statusEl = document.getElementById("status") as HTMLSpanElement | null;
  btnOpen = document.getElementById("btn-open") as HTMLButtonElement | null;
  btnConnect = document.getElementById("btn-connect") as HTMLButtonElement | null;
  fileInput = document.getElementById("file-input") as HTMLInputElement | null;

  if (!statusEl || !btnOpen || !btnConnect) {
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
    if (btnConnect) btnConnect.disabled = false;
  });
  agentConnect.onSshClose(() => setStatus("Session closed"));
  agentConnect.onSshData((data: string) => {
    if (terminal) terminal.write(data);
  });

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput?.files?.[0];
      if (!file) return;
      if (fileInput) fileInput.value = "";
      setStatus("Loading…");
      file.text().then((json: string) => loadBundleFromJson(agentConnect, json))
        .catch((err: Error) => setStatus("Error: " + (err?.message || "Could not read file")));
    });
  }

  btnOpen.addEventListener("click", () => {
    if (fileInput) {
      setStatus("Select a .opencaw file…");
      fileInput.click();
    } else {
      setStatus("File input not available");
    }
  });

  btnConnect.addEventListener("click", async () => {
    if (!currentBundle) return;
    if (btnConnect) btnConnect.disabled = true;
    setStatus("Connecting…");
    const result = await agentConnect.connect(currentBundle);
    if ("error" in result) {
      setStatus(result.error);
      if (btnConnect) btnConnect.disabled = false;
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    setStatus("Drop .opencaw file here");
  });
  document.addEventListener("dragleave", () => {
    setStatus("Import a .opencaw file to connect");
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus("Import a .opencaw file to connect");
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".opencaw") && !name.endsWith(".json")) {
      setStatus("Drop a .opencaw or .json connection file");
      return;
    }
    setStatus("Loading…");
    file.text().then((json: string) => loadBundleFromJson(agentConnect, json))
      .catch((err: Error) => setStatus("Error: " + (err?.message || "Could not read file")));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
