"use strict";
/// <reference lib="dom" />
const w = window;
const Terminal = w.Terminal;
const FitAddon = w.FitAddon;
let terminal = null;
let fitAddon = null;
let splashEl = null;
let splashStatusEl = null;
let splashErrorEl = null;
let appEl = null;
let welcomeEl = null;
let terminalContainer = null;
let statusEl = null;
function setSplashStatus(msg) {
    if (splashStatusEl)
        splashStatusEl.textContent = msg;
}
function showSplashError(msg) {
    if (splashErrorEl) {
        splashErrorEl.textContent = msg;
        splashErrorEl.style.display = "block";
    }
}
function hideSplashError() {
    if (splashErrorEl) {
        splashErrorEl.textContent = "";
        splashErrorEl.style.display = "none";
    }
}
function hideSplash() {
    if (splashEl)
        splashEl.classList.add("hidden");
}
function setStatus(msg) {
    if (statusEl)
        statusEl.textContent = msg;
}
function showTerminal() {
    if (welcomeEl)
        welcomeEl.style.display = "none";
    if (terminalContainer)
        terminalContainer.style.display = "flex";
    setTimeout(() => fitAddon?.fit?.(), 80);
}
function initTerminal() {
    if (terminal)
        return;
    const termEl = document.getElementById("terminal");
    if (!termEl || !Terminal)
        return;
    terminal = new Terminal({
        cursorBlink: true,
        theme: { background: "#0d0d0d", foreground: "#e5e5e5" },
    });
    fitAddon = FitAddon ? new (FitAddon.FitAddon || FitAddon)() : null;
    if (fitAddon)
        terminal.loadAddon(fitAddon);
    terminal.open(termEl);
    terminal.onData((data) => {
        if (w.agentConnect)
            w.agentConnect.sendInput(data);
    });
    if (fitAddon) {
        const ro = new ResizeObserver(() => fitAddon.fit());
        ro.observe(termEl);
    }
}
function enterTerminal(meta) {
    hideSplash();
    if (!appEl)
        return;
    appEl.style.display = "flex";
    initTerminal();
    if (terminal?.clear)
        terminal.clear();
    showTerminal();
    if (meta.skipInstallerSaved && meta.alreadyInstalled) {
        setStatus("Installer skipped for this droplet");
    }
    else {
        setStatus(meta.alreadyInstalled ? "Connected (already installed)" : "Connected");
    }
}
function init() {
    splashEl = document.getElementById("splash");
    splashStatusEl = document.getElementById("splash-status");
    splashErrorEl = document.getElementById("splash-error");
    appEl = document.getElementById("app");
    welcomeEl = document.getElementById("welcome");
    terminalContainer = document.getElementById("terminal-container");
    statusEl = document.getElementById("status");
    if (!splashEl || !appEl) {
        document.body.textContent = "UI elements missing.";
        return;
    }
    if (!w.agentConnect) {
        setSplashStatus("Preload not available");
        return;
    }
    appEl.style.display = "none";
    w.agentConnect.onSshConnected((meta) => {
        setSplashStatus("Connected");
        enterTerminal(meta);
    });
    w.agentConnect.onSshError((msg) => {
        let hint = "";
        if (msg.includes("ECONNREFUSED"))
            hint = " Wait 1–2 minutes if the droplet just started.";
        else if (msg.includes("authentication methods failed"))
            hint = " Use the .droplet from this droplet.";
        showSplashError("Error: " + msg + hint);
        setSplashStatus("Connection failed");
    });
    w.agentConnect.onSshClose(() => setStatus("Session closed"));
    w.agentConnect.onSshData((data) => {
        if (terminal)
            terminal.write(data);
    });
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
}
else {
    init();
}
