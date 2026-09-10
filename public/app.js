import { TalkingHead } from "talkinghead";

const avatarUrl = "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars/brunette.glb";
const app = document.getElementById("app");

const state = {
  route: "home",
  head: null,
  headNode: null,
  history: [],
  user: JSON.parse(localStorage.getItem("nova-user") || "null"),
  geminiKey: "",
  lastAnswer: null,
  muted: false
};

window.addEventListener("hashchange", render);
render();

async function render() {
  const route = location.hash.replace(/^#\/?/, "") || "home";
  state.route = route;

  document.querySelectorAll("[data-link]").forEach((link) => {
    link.classList.toggle(
      "active",
      link.dataset.link === route || (route === "" && link.dataset.link === "home")
    );
  });

  const template =
    document.getElementById(`${route}-page`) ||
    document.getElementById("home-page");

  app.replaceChildren(template.content.cloneNode(true));

  if (route === "home") {
    checkHealth();
    await mountAvatar(document.getElementById("home-avatar"), "upper");
  }

  if (route === "about") stopAvatar();

  if (route === "login") {
    stopAvatar();
    setupLogin();
  }

  if (route === "chat") {
    setupChat();
    await mountAvatar(document.getElementById("chat-avatar"), "mid");
  }
}

async function checkHealth() {
  const node = document.getElementById("key-status");
  if (!node) return;

  node.textContent = state.geminiKey
    ? "Key loaded for this session. Ready to talk."
    : "Paste your Gemini key in the chat page to enable answers.";
}

async function mountAvatar(node, view) {
  if (!node) return;
  if (state.headNode === node && state.head) return;

  stopAvatar();
  state.headNode = node;

  try {
    state.head = new TalkingHead(node, {
      lipsyncModules: ["en"],
      cameraView: view,
      avatarMood: "neutral",
      avatarSpeakingEyeContact: 0.72,
      avatarSpeakingHeadMove: 0.62,
      mixerGainSpeech: 1.45
    });

    await state.head.showAvatar(
      {
        url: avatarUrl,
        body: "F",
        lipsyncLang: "en"
      },
      (event) => {
        const loader = node.querySelector(".avatar-loader");
        if (loader && event.lengthComputable) {
          loader.textContent = `Loading avatar ${Math.round(
            (event.loaded / event.total) * 100
          )}%`;
        }
      }
    );

    state.head.setView(
      view,
      view === "mid"
        ? { cameraDistance: 0.75, cameraY: 0.1 }
        : { cameraDistance: 0.85 }
    );

    node.querySelector(".avatar-loader")?.remove();

    if (state.route === "home") {
      state.head.playGesture("handup", 2.6);
    }
  } catch (error) {
    node.querySelector(".avatar-loader").textContent =
      "Avatar could not load. Check your connection.";
    console.error(error);
  }
}

function stopAvatar() {
  if (!state.head) return;

  try {
    state.head.stop();
  } catch { }

  state.head = null;
  state.headNode = null;
}

function setupLogin() {
  const form = document.getElementById("login-form");
  if (!form) return;

  if (state.user) {
    form.name.value = state.user.name || "";
    form.email.value = state.user.email || "";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    state.user = {
      name: form.name.value.trim(),
      email: form.email.value.trim()
    };

    localStorage.setItem("nova-user", JSON.stringify(state.user));
    location.hash = "#/chat";
  });
}

function setupChat() {
  const title = document.getElementById("chat-title");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("message");
  const muteBtn = document.getElementById("mute-btn");
  const replayBtn = document.getElementById("replay-btn");
  const clearBtn = document.getElementById("clear-btn");
  const keyForm = document.getElementById("key-form");
  const keyInput = document.getElementById("gemini-key");
  const keyOpen = document.getElementById("key-open");
  const keyHelp = document.getElementById("key-help");
  const keyClear = document.getElementById("key-clear");

  title.textContent = state.user?.name
    ? `Ask anything, ${state.user.name}`
    : "Ask anything";

  setupKeyForm(keyForm, keyInput, keyOpen, keyHelp, keyClear);
  renderMessages();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    await sendMessage(message);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });

  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? "🔇" : "🔊";
    setStatus(state.muted ? "Muted" : "Ready");
  });

  replayBtn.addEventListener("click", () => {
    if (state.lastAnswer) speakAnswer(state.lastAnswer);
  });

  clearBtn.addEventListener("click", () => {
    state.history = [];
    state.lastAnswer = null;
    renderMessages();
    setStatus("Cleared");
  });
}

async function sendMessage(message) {
  if (!state.geminiKey) {
    pushMessage("model", "Please enter your Gemini API key.");
    setStatus("Key needed");
    return;
  }

  pushMessage("user", message);
  setBusy(true);
  setStatus("Thinking");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gemini-api-key": state.geminiKey
      },
      body: JSON.stringify({
        message,
        history: state.history.slice(-4)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The chat request failed.");
    }

    const answer = {
      text: data.reply,
      audio: data.audio,
      words: data.words
    };

    state.lastAnswer = answer;

    pushMessage("model", data.reply);
    await speakAnswer(answer);
  } catch (error) {
    pushMessage("model", error.message);
    setStatus("Needs attention");
  } finally {
    setBusy(false);
  }
}

function setupKeyForm(form, input, openButton, help, clearButton) {
  if (!form || !input || !openButton || !help || !clearButton) return;

  input.value = state.geminiKey;
  updateKeyButton(openButton, help);

  openButton.addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) input.focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.geminiKey = input.value.trim();

    updateKeyButton(openButton, help);
    form.hidden = keyLooksLikeGeminiApiKey(state.geminiKey);
    setStatus(keyLooksLikeGeminiApiKey(state.geminiKey) ? "Key loaded" : "Check key");
  });

  clearButton.addEventListener("click", () => {
    state.geminiKey = "";
    input.value = "";
    updateKeyButton(openButton, help);
    setStatus("Key cleared");
  });
}

function updateKeyButton(button, help) {
  const hasValidKey = keyLooksLikeGeminiApiKey(state.geminiKey);
  button.textContent = hasValidKey ? "Key loaded" : "API key";

  if (!state.geminiKey) {
    help.textContent = "Your key is kept only until this page is refreshed or reopened.";
    return;
  }

  help.textContent = hasValidKey
    ? `Loaded key ${state.geminiKey.slice(0, 6)}...${state.geminiKey.slice(-4)}`
    : `This key starts with ${state.geminiKey.slice(0, 6)}..., but Gemini keys usually start with AIza.`;
}

function keyLooksLikeGeminiApiKey(key = "") {
  return key.startsWith("AIza") && key.length >= 30 && !/\s/.test(key);
}

function pushMessage(role, text) {
  state.history.push({ role, text });
  state.history = state.history.slice(-18);
  renderMessages();
}

function renderMessages() {
  const messages = document.getElementById("messages");
  if (!messages) return;

  messages.replaceChildren();

  const visible = state.history.length
    ? state.history
    : [
      {
        role: "model",
        text: "Hi, I am Nova. Send me a message and I will answer with voice."
      }
    ];

  for (const item of visible) {
    const bubble = document.createElement("div");
    bubble.className = `message ${item.role === "user" ? "user" : "model"
      }`;

    bubble.innerHTML = `<small>${item.role === "user" ? "You" : "Nova"
      }</small>${escapeHtml(item.text)}`;

    messages.appendChild(bubble);
  }

  messages.scrollTop = messages.scrollHeight;
}

async function speakAnswer(answer) {
  if (!state.head || state.muted || !answer?.audio?.data) {
    setStatus(state.muted ? "Muted" : "Ready");
    return;
  }

  setStatus("Speaking");

  try {
    const buffer = await audioBufferFromBase64(answer.audio.data);

    const speech = {
      audio: buffer,
      words: answer.words?.words || [],
      wtimes: answer.words?.wtimes || [],
      wdurations: answer.words?.wdurations || []
    };

    state.head.speakAudio(
      speech,
      { lipsyncLang: "en", avatarMood: "happy" },
      () => setStatus("Speaking")
    );

    state.head.playGesture("ok", 2.2);

    const waitMs = Math.min(
      45000,
      Math.max(1000, answer.audio.durationMs || 4000)
    );

    setTimeout(() => setStatus("Ready"), waitMs + 500);
  } catch (error) {
    console.error(error);
    setStatus("Voice playback failed");
  }
}

async function audioBufferFromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const context = new AudioContext();
  return context.decodeAudioData(bytes.buffer);
}

function setBusy(isBusy) {
  document
    .getElementById("send-btn")
    ?.classList.toggle("is-busy", isBusy);

  document
    .getElementById("message")
    ?.toggleAttribute("disabled", isBusy);
}

function setStatus(text) {
  const node = document.getElementById("chat-status");
  if (node) node.textContent = text;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}
