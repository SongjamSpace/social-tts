"use strict";

const express = require("express");
const OpenAI = require("openai").default;

const PORT = process.env.PORT || 8080;

/** Infer LLM provider from API key format. Do not log the key. */
function inferProvider(apiKey) {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  return "openai";
}

/** Build agent system prompt from SEED_MEMORIES_JSON. */
function buildAgentSystemPrompt() {
  const raw = process.env.SEED_MEMORIES_JSON;
  if (!raw || typeof raw !== "string") {
    console.warn("[openclaw-agent] SEED_MEMORIES_JSON missing or invalid; using fallback prompt.");
    return "You are an OpenClaw agent. Respond in character. Keep responses concise.";
  }
  let seed;
  try {
    seed = JSON.parse(raw);
  } catch (e) {
    console.warn("[openclaw-agent] SEED_MEMORIES_JSON parse error:", e.message);
    return "You are an OpenClaw agent. Respond in character. Keep responses concise.";
  }
  if (!seed || typeof seed !== "object") {
    return "You are an OpenClaw agent. Respond in character. Keep responses concise.";
  }
  const name = seed.name && typeof seed.name === "string" ? seed.name : "OpenClaw Agent";
  const ticker = seed.ticker && typeof seed.ticker === "string" ? seed.ticker : "";
  const description = seed.description && typeof seed.description === "string" ? seed.description : "";
  const tone = seed.tone && typeof seed.tone === "string" ? seed.tone : "";
  const twitter = seed.twitter && typeof seed.twitter === "string" ? seed.twitter : "";
  const website = seed.website && typeof seed.website === "string" ? seed.website : "";
  const telegram = seed.telegram && typeof seed.telegram === "string" ? seed.telegram : "";

  const parts = [`You are ${name}.`];
  if (ticker) parts.push(`Your ticker/symbol is ${ticker}.`);
  if (description) parts.push(description);
  if (tone) parts.push(`Your tone: ${tone}.`);
  const socials = [];
  if (twitter) socials.push(`X (Twitter): ${twitter}`);
  if (website) socials.push(`Website: ${website}`);
  if (telegram) socials.push(`Telegram: ${telegram}`);
  if (socials.length) parts.push("Social: " + socials.join(", ") + ".");
  parts.push("Respond in character as this agent. Keep responses concise.");
  return parts.join(" ");
}

const agentSystemPrompt = buildAgentSystemPrompt();
const agentName = (() => {
  try {
    const raw = process.env.SEED_MEMORIES_JSON;
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.name === "string") return s.name;
    }
  } catch (_) {}
  return "OpenClaw Agent";
})();

const app = express();
app.use(express.json({ limit: "1mb" }));

/** Chat UI: single page with message list, input, optional API key, and NDJSON streaming. */
function getChatHtml() {
  const rawTitle = agentName || "OpenClaw Agent";
  const title = String(rawTitle).replace(/\r?\n/g, " ").trim().slice(0, 100);
  const welcomeText = "Hi, I'm " + title + ". Ask me anything or tell me what you'd like to do.";
  const welcomeHtml = "<div class=\"msg assistant\">" + escapeHtml(welcomeText) + "</div>";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0a0a0c; color: #e4e4e7; margin: 0; padding: 1rem; min-height: 100vh; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem 0; color: #fff; }
    #messages { max-width: 42rem; margin: 0 auto 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .msg { padding: 0.75rem 1rem; border-radius: 0.75rem; max-width: 85%; }
    .msg.user { background: rgba(255,255,255,0.08); align-self: flex-end; }
    .msg.assistant { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); align-self: flex-start; white-space: pre-wrap; word-break: break-word; }
    #inputRow { max-width: 42rem; margin: 0 auto; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    #input { flex: 1; min-width: 12rem; padding: 0.6rem 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #fff; font-size: 0.95rem; }
    #input:focus { outline: none; border-color: rgba(239,68,68,0.5); }
    button { padding: 0.6rem 1rem; border-radius: 0.5rem; border: none; background: #ef4444; color: #fff; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
    button:hover { background: #dc2626; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .apiKeyWrap { width: 100%; margin-top: 0.5rem; }
    .apiKeyWrap label { font-size: 0.75rem; color: #71717a; display: block; margin-bottom: 0.25rem; }
    .apiKeyWrap input { width: 100%; padding: 0.4rem 0.5rem; border-radius: 0.375rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #a1a1aa; font-size: 0.8rem; }
    #error { color: #f87171; font-size: 0.875rem; margin-top: 0.5rem; max-width: 42rem; margin-left: auto; margin-right: auto; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div id="messages">${welcomeHtml}</div>
  <div id="inputRow">
    <input type="text" id="input" placeholder="Message..." autocomplete="off" />
    <button type="button" id="send">Send</button>
    <div class="apiKeyWrap">
      <label for="apiKey">API key (optional if owner set LLM_API_KEY)</label>
      <input type="password" id="apiKey" placeholder="OpenAI or Anthropic key" autocomplete="off" />
    </div>
  </div>
  <div id="error"></div>
  <script>
    const messagesEl = document.getElementById("messages");
    const inputEl = document.getElementById("input");
    const sendBtn = document.getElementById("send");
    const apiKeyEl = document.getElementById("apiKey");
    const errorEl = document.getElementById("error");

    function escapeHtml(s) {
      const div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    function addMessage(role, content) {
      const div = document.createElement("div");
      div.className = "msg " + role;
      div.textContent = content;
      messagesEl.appendChild(div);
      return div;
    }

    function setError(msg) {
      errorEl.textContent = msg || "";
    }

    async function sendChat() {
      const text = (inputEl.value || "").trim();
      if (!text) return;
      const apiKey = (apiKeyEl.value || "").trim();
      addMessage("user", text);
      inputEl.value = "";
      sendBtn.disabled = true;
      setError("");
      const messages = [];
      for (const el of messagesEl.querySelectorAll(".msg")) {
        const isUser = el.classList.contains("user");
        messages.push({ role: isUser ? "user" : "assistant", content: el.textContent });
      }
      const assistantDiv = addMessage("assistant", "");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, apiKey: apiKey || undefined }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Chat request failed");
          assistantDiv.textContent = "(Error)";
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (typeof data.chunk === "string") assistantDiv.textContent += data.chunk;
              if (data.done) break;
              if (data.error) {
                setError(data.error);
                if (!assistantDiv.textContent) assistantDiv.textContent = "(Error)";
              }
            } catch (_) {}
          }
        }
      } catch (e) {
        setError(e.message || "Request failed");
        if (!assistantDiv.textContent) assistantDiv.textContent = "(Error)";
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener("click", sendChat);
    inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\`/g, "&#96;")
    .replace(/\r?\n/g, " ");
}

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(getChatHtml());
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/** Stream NDJSON: { chunk } then { done: true }. Same contract as eve seed chat. */
app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body || {};
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const resolvedKey = apiKey || (process.env.LLM_API_KEY || "").trim();
    if (!resolvedKey) {
      return res.status(400).json({
        error: "No API key provided. Set apiKey in the request body or set LLM_API_KEY for this agent.",
      });
    }
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages = rawMessages
      .filter((m) => m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: String(m.content) }));

    const provider = inferProvider(resolvedKey);

    const send = (obj) => {
      res.write(JSON.stringify(obj) + "\n");
    };

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-store");
    res.flushHeaders && res.flushHeaders();

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: resolvedKey });
      const apiMessages = [
        { role: "system", content: agentSystemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: apiMessages,
        max_tokens: 1024,
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content ?? "";
        if (text) send({ chunk: text });
      }
      send({ done: true });
      res.end();
      return;
    }

    if (provider === "anthropic") {
      const anthropicMessages = messages.map((m) => ({ role: m.role, content: m.content }));
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": resolvedKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "streaming-2024-07-22",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: agentSystemPrompt,
          messages: anthropicMessages,
          stream: true,
        }),
      });
      if (!anthropicRes.ok) {
        const data = await anthropicRes.json().catch(() => ({}));
        const err = data?.error?.message ?? data?.message ?? anthropicRes.statusText;
        send({ error: err || "Anthropic API error" });
        send({ done: true });
        res.end();
        return;
      }
      const reader = anthropicRes.body;
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") continue;
          try {
            const data = JSON.parse(raw);
            if (data.type === "content_block_delta" && data.delta?.text) {
              send({ chunk: data.delta.text });
            }
          } catch (_) {}
        }
      }
      send({ done: true });
      res.end();
      return;
    }

    send({ error: "Could not detect provider from API key. Use OpenAI or Anthropic." });
    send({ done: true });
    res.end();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.status(500).write(JSON.stringify({ error: message }) + "\n");
      res.write(JSON.stringify({ done: true }) + "\n");
    }
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OpenClaw agent listening on ${PORT}`);
});
