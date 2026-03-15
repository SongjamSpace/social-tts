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
    if (terminal && fitAddon) {
        setTimeout(() => fitAddon.fit(), 50);
    }
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
        const resizeObserver = new ResizeObserver(() => fitAddon.fit());
        resizeObserver.observe(termEl);
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
        document.body.textContent = "UI elements missing. Check the console.";
        return;
    }
    const agentConnect = w.agentConnect;
    if (!agentConnect) {
        setSplashStatus("Preload not available");
        return;
    }
    appEl.style.display = "none";
    agentConnect.onSshConnected(() => {
        setSplashStatus("Connected");
        hideSplash();
        appEl.style.display = "flex";
        initTerminal();
        showTerminal();
        setStatus("Connected");
    });
    agentConnect.onSshError((msg) => {
        let hint = "";
        if (msg.includes("ECONNREFUSED")) {
            hint = " The droplet may still be starting—wait 1–2 minutes and try again.";
        }
        else if (msg.includes("authentication methods failed")) {
            hint = " Use the connection file you downloaded when you created this droplet.";
        }
        showSplashError("Error: " + msg + hint);
        setSplashStatus("Connection failed");
    });
    agentConnect.onSshClose(() => setStatus("Session closed"));
    agentConnect.onSshData((data) => {
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
