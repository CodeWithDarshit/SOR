const storageKey = "sor-ai-conversations";
const settingsKey = "sor-ai-settings";

const nodes = {
  connectionStatus: document.querySelector("#connectionStatus"),
  conversationList: document.querySelector("#conversationList"),
  conversationTitle: document.querySelector("#conversationTitle"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  newChatButton: document.querySelector("#newChatButton"),
  clearButton: document.querySelector("#clearButton"),
  exportButton: document.querySelector("#exportButton"),
  regenerateButton: document.querySelector("#regenerateButton"),
  searchInput: document.querySelector("#searchInput"),
  modeSelect: document.querySelector("#modeSelect"),
  modelSelect: document.querySelector("#modelSelect"),
  reasoningSelect: document.querySelector("#reasoningSelect"),
  toneSelect: document.querySelector("#toneSelect"),
  languageSelect: document.querySelector("#languageSelect"),
  avatarSelect: document.querySelector("#avatarSelect"),
  systemPromptInput: document.querySelector("#systemPromptInput"),
  avatarStage: document.querySelector("#avatarStage"),
  avatarName: document.querySelector("#avatarName"),
  avatarStatus: document.querySelector("#avatarStatus"),
  speakButton: document.querySelector("#speakButton"),
};

const languageMeta = {
  auto: { name: "Auto detect", speech: "" },
  en: { name: "English", speech: "en-US" },
  hi: { name: "Hindi", speech: "hi-IN" },
  hinglish: { name: "Hinglish", speech: "hi-IN" },
  gu: { name: "Gujarati", speech: "gu-IN" },
  mr: { name: "Marathi", speech: "mr-IN" },
  ta: { name: "Tamil", speech: "ta-IN" },
  te: { name: "Telugu", speech: "te-IN" },
  bn: { name: "Bengali", speech: "bn-IN" },
  es: { name: "Spanish", speech: "es-ES" },
  fr: { name: "French", speech: "fr-FR" },
  ar: { name: "Arabic", speech: "ar-SA" },
};

const avatarProfiles = {
  nova: { name: "Nova", status: "Ready for multilingual chat" },
  mentor: { name: "Mentor", status: "Study guide mode online" },
  coder: { name: "Coder", status: "Development assistant active" },
  calm: { name: "Calm", status: "Slow, clear explanations ready" },
};

const roleLabels = {
  user: "Question",
  assistant: "Answer",
};

let conversations = loadConversations();
let activeId = conversations[0]?.id || createConversation().id;
let controller = null;

function loadConversations() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(settingsKey)) || {};
  } catch {
    return {};
  }
}

function saveConversations() {
  localStorage.setItem(storageKey, JSON.stringify(conversations));
}

function saveSettings() {
  localStorage.setItem(
    settingsKey,
    JSON.stringify({
      mode: nodes.modeSelect.value,
      model: nodes.modelSelect.value,
      reasoningEffort: nodes.reasoningSelect.value,
      tone: nodes.toneSelect.value,
      language: nodes.languageSelect.value,
      avatar: nodes.avatarSelect.value,
      systemPrompt: nodes.systemPromptInput.value,
    }),
  );
}

function createConversation() {
  const conversation = {
    id: crypto.randomUUID(),
    title: "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  conversations.unshift(conversation);
  saveConversations();
  return conversation;
}

function currentConversation() {
  return conversations.find((conversation) => conversation.id === activeId) || conversations[0];
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMarkdownLite(text) {
  const escaped = escapeHtml(text || "");
  const withCode = escaped.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  return withCode
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function titleFromMessage(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 52 ? `${clean.slice(0, 52)}...` : clean || "New conversation";
}

function renderConversations() {
  const query = nodes.searchInput.value.trim().toLowerCase();
  nodes.conversationList.innerHTML = "";

  conversations
    .filter((conversation) => {
      const haystack = `${conversation.title} ${conversation.messages.map((message) => message.content).join(" ")}`;
      return haystack.toLowerCase().includes(query);
    })
    .forEach((conversation) => {
      const button = document.createElement("button");
      button.className = `conversation-item ${conversation.id === activeId ? "active" : ""}`;
      button.type = "button";
      button.innerHTML = `
        <strong>${escapeHtml(conversation.title)}</strong>
        <span>${conversation.messages.length} messages</span>
      `;
      button.addEventListener("click", () => {
        activeId = conversation.id;
        render();
      });
      nodes.conversationList.appendChild(button);
    });
}

function renderMessages() {
  const conversation = currentConversation();
  nodes.messages.innerHTML = "";
  nodes.conversationTitle.textContent = conversation.title;

  if (!conversation.messages.length) {
    nodes.messages.innerHTML = `
      <div class="empty-state">
        <h3>Ask a question. Get a clear answer. Continue the conversation naturally.</h3>
        <div class="starter-grid">
          <button type="button">What features should my ChatGPT clone have from basic to advanced?</button>
          <button type="button">How can I make this MERN chat app look and work more like ChatGPT?</button>
          <button type="button">Explain how frontend and backend communicate in this AI chat project.</button>
          <button type="button">मेरे AI chat project को Hindi और English दोनों में कैसे support करूं?</button>
        </div>
      </div>
    `;
    nodes.messages.querySelectorAll(".starter-grid button").forEach((button) => {
      button.addEventListener("click", () => {
        nodes.messageInput.value = button.textContent.trim();
        resizeInput();
        nodes.messageInput.focus();
      });
    });
    return;
  }

  conversation.messages.forEach((message, index) => {
    const turn = Math.floor(index / 2) + 1;
    const article = document.createElement("article");
    article.className = `message ${message.role}`;
    article.innerHTML = `
      <div class="message-meta">
        <span>${roleLabels[message.role] || message.role}</span>
        <span>Turn ${turn}</span>
      </div>
      <div class="bubble">${renderMarkdownLite(message.content)}</div>
      <div class="message-actions">
        <button type="button" data-copy="${index}">Copy</button>
      </div>
    `;
    nodes.messages.appendChild(article);
  });

  nodes.messages.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const message = conversation.messages[Number(button.dataset.copy)];
      await navigator.clipboard.writeText(message.content);
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = "Copy"), 900);
    });
  });

  nodes.messages.scrollTop = nodes.messages.scrollHeight;
}

function render() {
  renderConversations();
  renderMessages();
}

function getSettings() {
  return {
    mode: nodes.modeSelect.value,
    model: nodes.modelSelect.value,
    reasoningEffort: nodes.reasoningSelect.value,
    tone: nodes.toneSelect.value,
    language: nodes.languageSelect.value,
    avatar: nodes.avatarSelect.value,
    systemPrompt: nodes.systemPromptInput.value,
  };
}

function setStreaming(isStreaming) {
  nodes.sendButton.textContent = isStreaming ? "Stop" : "Send";
  nodes.sendButton.classList.toggle("streaming", isStreaming);
  nodes.avatarStage.classList.toggle("thinking", isStreaming);
  nodes.avatarStatus.textContent = isStreaming ? "Thinking and speaking..." : avatarProfiles[nodes.avatarSelect.value].status;
}

function updateAvatar() {
  const profile = avatarProfiles[nodes.avatarSelect.value] || avatarProfiles.nova;
  const language = languageMeta[nodes.languageSelect.value] || languageMeta.auto;
  nodes.avatarName.textContent = profile.name;
  nodes.avatarStage.dataset.avatar = nodes.avatarSelect.value;
  nodes.avatarStatus.textContent = `${profile.status} - ${language.name}`;
}

async function readEventStream(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventBlock of events) {
      const eventName = eventBlock.match(/^event:\s*(.+)$/m)?.[1];
      const dataText = eventBlock.match(/^data:\s*(.+)$/m)?.[1];
      if (!eventName || !dataText) continue;

      const data = JSON.parse(dataText);
      if (eventName === "delta") onDelta(data.text || "");
      if (eventName === "error") throw new Error(data.detail || data.message || "AI stream failed.");
    }
  }
}

async function sendMessage(text) {
  const conversation = currentConversation();
  conversation.messages.push({ role: "user", content: text });
  if (conversation.title === "New conversation") {
    conversation.title = titleFromMessage(text);
  }
  conversation.updatedAt = Date.now();

  const assistantMessage = { role: "assistant", content: "" };
  conversation.messages.push(assistantMessage);
  saveConversations();
  render();

  controller = new AbortController();
  setStreaming(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversation.messages.slice(0, -1),
        settings: getSettings(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await readEventStream(response, (delta) => {
      assistantMessage.content += delta;
      conversation.updatedAt = Date.now();
      saveConversations();
      renderMessages();
    });
  } catch (error) {
    if (error.name !== "AbortError") {
      assistantMessage.content += `\n\nError: ${error.message}`;
    }
  } finally {
    controller = null;
    setStreaming(false);
    saveConversations();
    render();
  }
}

function resizeInput() {
  nodes.messageInput.style.height = "auto";
  nodes.messageInput.style.height = `${nodes.messageInput.scrollHeight}px`;
}

async function applyPromptTool(tool) {
  const text = nodes.messageInput.value.trim();
  if (!text) return;

  const response = await fetch("/api/prompt-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, text }),
  });
  const result = await response.json();
  nodes.messageInput.value = result.text || text;
  resizeInput();
  nodes.messageInput.focus();
}

function getLastAssistantMessage() {
  return [...currentConversation().messages].reverse().find((message) => message.role === "assistant" && message.content);
}

function speakLastAssistantMessage() {
  const message = getLastAssistantMessage();
  if (!message || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message.content.replace(/```[\s\S]*?```/g, " code block omitted "));
  const meta = languageMeta[nodes.languageSelect.value] || languageMeta.auto;
  if (meta.speech) utterance.lang = meta.speech;
  utterance.rate = 0.96;
  utterance.pitch = nodes.avatarSelect.value === "calm" ? 0.9 : 1;
  utterance.onstart = () => nodes.avatarStage.classList.add("speaking");
  utterance.onend = () => nodes.avatarStage.classList.remove("speaking");
  utterance.onerror = () => nodes.avatarStage.classList.remove("speaking");
  window.speechSynthesis.speak(utterance);
}

nodes.composer.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (controller) {
    controller.abort();
    return;
  }

  const text = nodes.messageInput.value.trim();
  if (!text) return;

  nodes.messageInput.value = "";
  resizeInput();
  await sendMessage(text);
});

nodes.messageInput.addEventListener("input", resizeInput);
nodes.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    nodes.composer.requestSubmit();
  }
});

nodes.newChatButton.addEventListener("click", () => {
  activeId = createConversation().id;
  render();
  nodes.messageInput.focus();
});

nodes.clearButton.addEventListener("click", () => {
  const conversation = currentConversation();
  conversation.messages = [];
  conversation.title = "New conversation";
  conversation.updatedAt = Date.now();
  saveConversations();
  render();
});

nodes.exportButton.addEventListener("click", () => {
  const conversation = currentConversation();
  const content = conversation.messages
    .map((message) => `## ${message.role.toUpperCase()}\n\n${message.content}`)
    .join("\n\n");
  const blob = new Blob([`# ${conversation.title}\n\n${content}`], { type: "text/markdown" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "sor-ai-chat"}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
});

nodes.regenerateButton.addEventListener("click", async () => {
  const conversation = currentConversation();
  const lastUserIndex = conversation.messages.map((message) => message.role).lastIndexOf("user");
  if (lastUserIndex === -1 || controller) return;

  const lastPrompt = conversation.messages[lastUserIndex].content;
  conversation.messages = conversation.messages.slice(0, lastUserIndex);
  saveConversations();
  await sendMessage(lastPrompt);
});

nodes.searchInput.addEventListener("input", renderConversations);
nodes.speakButton.addEventListener("click", speakLastAssistantMessage);
document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => applyPromptTool(button.dataset.tool));
});

[nodes.modeSelect, nodes.modelSelect, nodes.reasoningSelect, nodes.toneSelect, nodes.languageSelect, nodes.avatarSelect, nodes.systemPromptInput].forEach(
  (node) =>
    node.addEventListener("change", () => {
      saveSettings();
      updateAvatar();
    }),
);
nodes.systemPromptInput.addEventListener("input", saveSettings);

async function boot() {
  const settings = loadSettings();
  nodes.modeSelect.value = settings.mode || "general";
  nodes.modelSelect.value = settings.model || "gpt-5.5";
  nodes.reasoningSelect.value = settings.reasoningEffort || "low";
  nodes.toneSelect.value = settings.tone || "balanced";
  nodes.languageSelect.value = settings.language || "auto";
  nodes.avatarSelect.value = settings.avatar || "nova";
  nodes.systemPromptInput.value = settings.systemPrompt || "";
  updateAvatar();

  try {
    const health = await fetch("/api/health").then((response) => response.json());
    nodes.connectionStatus.textContent = health.hasOpenAIKey ? "OpenAI connected" : "Demo mode: add API key";
  } catch {
    nodes.connectionStatus.textContent = "Backend unavailable";
  }

  render();
}

boot();
