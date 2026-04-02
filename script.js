/* ═══════════════════════════════════════════════
   JARVIS — script.js  v2.0
   ─ Theme switcher, Chat, Voice (STT/TTS)
   ═══════════════════════════════════════════════ */
const API = "https://jarvix-chatbot-yee2-h2ka3jouh-ktejaskuppusamy-1637s-projects.vercel.app/api/app";

/* ══════════════════════════════════════
   DOM REFS
══════════════════════════════════════ */
const chatBox        = document.getElementById("chatBox");
const chatInput      = document.getElementById("chatInput");
const sendBtn        = document.getElementById("sendBtn");
const micBtn         = document.getElementById("micBtn");
const speakInputBtn  = document.getElementById("speakInputBtn");
// ttsToggle is removed from header; keep a safe reference to avoid errors in legacy code
const ttsToggle      = document.getElementById("ttsToggle") || { addEventListener: () => {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} }, title: "" };
const langSelect     = document.getElementById("langSelect");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeDropdown  = document.getElementById("themeDropdown");
const welcomeMsg     = document.getElementById("welcomeMsg");

/* ══════════════════════════════════════
   THEME SWITCHER
══════════════════════════════════════ */

const THEMES = ["dark", "neon", "pastel", "spiderman", "ironman", "thor", "cap"];
let currentTheme = localStorage.getItem("jarvis-theme") || "dark";

// Overlay elements (injected once)
let overlaysReady = false;

function injectOverlays() {
  if (overlaysReady) return;
  overlaysReady = true;

  // HUD grid (Iron Man)
  const hudGrid = document.createElement("div");
  hudGrid.className = "hud-grid-overlay";
  document.body.insertBefore(hudGrid, document.body.firstChild);

  // Lightning (Thor)
  const lightning = document.createElement("div");
  lightning.className = "lightning-overlay";
  for (let i = 0; i < 5; i++) {
    const bolt = document.createElement("div");
    bolt.className = "lightning-bolt";
    lightning.appendChild(bolt);
  }
  document.body.insertBefore(lightning, document.body.firstChild);

  // Stars / Shield rings (Captain America)
  const stars = document.createElement("div");
  stars.className = "star-overlay";
  for (let i = 0; i < 4; i++) {
    const ring = document.createElement("div");
    ring.className = "shield-ring";
    stars.appendChild(ring);
  }
  document.body.insertBefore(stars, document.body.firstChild);
}

function applyTheme(theme) {
  injectOverlays();
  document.documentElement.setAttribute("data-theme", theme);
  currentTheme = theme;
  localStorage.setItem("jarvis-theme", theme);

  document.querySelectorAll(".theme-opt").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}

// Toggle dropdown
themeToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themeDropdown.classList.toggle("open");
});

document.addEventListener("click", () => themeDropdown.classList.remove("open"));
themeDropdown.addEventListener("click", e => e.stopPropagation());

document.querySelectorAll(".theme-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    applyTheme(btn.dataset.theme);
    themeDropdown.classList.remove("open");
  });
});

// Add new theme options to the dropdown
(function addNewThemeOptions() {
  const newThemes = [
    { id: "ironman", label: "🔴 Iron Man",         previewClass: "ironman-prev" },
    { id: "thor",    label: "⚡ Thor",              previewClass: "thor-prev"    },
    { id: "cap",     label: "🛡 Captain America",   previewClass: "cap-prev"     },
  ];

  newThemes.forEach(t => {
    if (document.querySelector(`.theme-opt[data-theme="${t.id}"]`)) return; // already exists

    const btn = document.createElement("button");
    btn.className = "theme-opt";
    btn.dataset.theme = t.id;
    btn.innerHTML = `
      <span class="theme-preview ${t.previewClass}"></span>
      <span>${t.label}</span>
      <span class="theme-check">✓</span>
    `;
    btn.addEventListener("click", () => {
      applyTheme(t.id);
      themeDropdown.classList.remove("open");
    });
    themeDropdown.appendChild(btn);
  });
})();

// Init theme
applyTheme(currentTheme);

/* ══════════════════════════════════════
   LANGUAGE CONFIG — Full multilingual
══════════════════════════════════════ */
const LANG_MAP = {
  "en": { label: "🇺🇸 English", bcp47: "en-US", gtts: "en", needsTranslation: false },
  "ta": { label: "🇮🇳 Tamil",   bcp47: "ta-IN", gtts: "ta", needsTranslation: true  },
  "hi": { label: "🇮🇳 Hindi",   bcp47: "hi-IN", gtts: "hi", needsTranslation: true  },
};

function getLang() {
  const val = langSelect ? langSelect.value : "en";
  return LANG_MAP[val] ? LANG_MAP[val].bcp47 : "en-US";
}

function getLangConfig() {
  const val = langSelect ? langSelect.value : "en";
  return LANG_MAP[val] || LANG_MAP["en"];
}

// Restore saved language on load
(function restoreLang() {
  const saved = localStorage.getItem("jarvis-lang");
  if (saved && langSelect && LANG_MAP[saved]) {
    langSelect.value = saved;
  }
})();

// Language change handler — save + show toast
function onLangChange(val) {
  localStorage.setItem("jarvis-lang", val);
  const cfg = LANG_MAP[val] || LANG_MAP["en"];
  showLangToast("🌐 Language: " + cfg.label);
}

function showLangToast(msg) {
  const t = document.getElementById("langToast");
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = "1";
  t.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(window._langToastTimer);
  window._langToastTimer = setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(16px)";
  }, 2500);
}

/* ══════════════════════════════════════
   CORE TTS — speakText(text)
   Always active. No on/off toggle.
   English  → Web Speech API
   Tamil/Hindi → Flask /translate → Flask /tts (CORS-safe proxy)
══════════════════════════════════════ */

async function speakText(text) {
  if (!text || !text.trim()) return;

  // Stop any currently playing audio
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (window._ttsAudio) {
    window._ttsAudio.pause();
    window._ttsAudio = null;
  }

  const cfg = getLangConfig();
  console.log("[TTS] Language:", cfg.gtts, "|", cfg.label);

  // ── ENGLISH: Web Speech API ──
  if (!cfg.needsTranslation) {
    _speakEnglish(text);
    return;
  }

  // ── TAMIL / HINDI ──
  // 1. Translate via Flask proxy
  let translated = text;
  try {
    const res = await fetch(
      `${API}/translate?text=${encodeURIComponent(text)}&langpair=en|${cfg.gtts}`
    );
    const data = await res.json();
    if (data.ok && data.translated && data.translated.trim()) {
      translated = data.translated;
      console.log("[TTS] Translated:", translated);
    } else {
      console.warn("[TTS] Translation failed, speaking original");
    }
  } catch (e) {
    console.warn("[TTS] /translate fetch error:", e);
  }

  // 2. Play via Flask /tts proxy (no CORS)
  await _playTTSChunks(translated, cfg.gtts);
}

// Chunk text and play each via backend /tts proxy
function _playTTSChunks(text, lang) {
  return new Promise((resolve) => {
    // Split into ≤190-char word-safe chunks
    const chunks = [];
    let chunk = "";
    for (const word of text.split(" ")) {
      if ((chunk + " " + word).trim().length > 190) {
        if (chunk) chunks.push(chunk.trim());
        chunk = word;
      } else {
        chunk += (chunk ? " " : "") + word;
      }
    }
    if (chunk.trim()) chunks.push(chunk.trim());

    console.log("[TTS] Chunks:", chunks.length);
    let idx = 0;

    function next() {
      if (idx >= chunks.length) { resolve(); return; }
      const url = `${API}/tts?text=${encodeURIComponent(chunks[idx])}&lang=${lang}`;
      console.log("[TTS] Playing chunk", idx + 1, ":", chunks[idx]);
      const audio = new Audio(url);
      window._ttsAudio = audio;
      audio.onended  = () => { idx++; next(); };
      audio.onerror  = (e) => { console.error("[TTS] chunk error:", e); idx++; next(); };
      audio.play().catch((e) => { console.error("[TTS] play blocked:", e); idx++; next(); });
    }
    next();
  });
}

// English Web Speech with Google TTS fallback
function _speakEnglish(text) {
  if (!window.speechSynthesis) {
    _fallbackGoogleTTS(text, "en");
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  let started = false;
  utter.onstart = () => { started = true; };
  utter.onerror  = () => { if (!started) _fallbackGoogleTTS(text, "en"); };

  function go() {
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => v.lang === "en-US" && v.name.includes("Google"))
           || voices.find(v => v.lang === "en-US")
           || voices.find(v => v.lang.startsWith("en"));
    if (v) utter.voice = v;
    speechSynthesis.speak(utter);
    setTimeout(() => { if (!started) _fallbackGoogleTTS(text, "en"); }, 2500);
  }

  speechSynthesis.getVoices().length ? go() : (speechSynthesis.onvoiceschanged = go);
}

function _fallbackGoogleTTS(text, lang) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  const a = new Audio(url);
  window._ttsAudio = a;
  a.play().catch(() => {});
}

// Keep old name as alias so sendChat() still works
const speak = speakText;

document.addEventListener("click", () => {
  if (window.speechSynthesis) speechSynthesis.resume();
});

/* ══════════════════════════════════════
   STT — SPEECH TO TEXT
══════════════════════════════════════ */

let recognition = null;
let isListening  = false;

function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.continuous      = false;
  r.interimResults  = false;
  r.lang            = getLang();

  r.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    autoResize(chatInput);
    stopListening();
    sendChat();
  };

  r.onerror = (e) => {
    console.error("Speech error:", e.error);
    stopListening();
    if (e.error === "not-allowed") {
      appendMessage("bot", "⚠️ Microphone access denied. Please allow mic permissions.", true);
    }
  };

  r.onend = () => stopListening();
  return r;
}

function startListening() {
  if (isListening) { stopListening(); return; }
  recognition = initRecognition();
  if (!recognition) {
    appendMessage("bot", "⚠️ Speech recognition is not supported in your browser.", true);
    return;
  }
  recognition.lang = getLang();
  recognition.start();
  isListening = true;
  micBtn.classList.add("listening");
}

function stopListening() {
  isListening = false;
  micBtn.classList.remove("listening");
  if (recognition) { try { recognition.stop(); } catch (_) {} }
}

micBtn.addEventListener("click", startListening);

/* ══════════════════════════════════════
   SPEAK TYPED TEXT BUTTON
   Types text → translates to selected language → speaks it
══════════════════════════════════════ */
speakInputBtn.addEventListener("click", async () => {
  const text = chatInput.value.trim();

  if (!text) {
    speakInputBtn.classList.add("speak-flash");
    setTimeout(() => speakInputBtn.classList.remove("speak-flash"), 600);
    return;
  }

  speakInputBtn.classList.add("speaking");
  try {
    await speakText(text);
  } catch (e) {
    console.error("[SpeakBtn]", e);
  }
  speakInputBtn.classList.remove("speaking");
});

/* ══════════════════════════════════════
   CHAT HISTORY — localStorage helpers
══════════════════════════════════════ */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem("jarvis-history") || "[]"); }
  catch { return []; }
}
function saveHistory(h) {
  localStorage.setItem("jarvis-history", JSON.stringify(h));
}
function pushHistory(role, text) {
  const h = loadHistory();
  h.push({ role, text, time: Date.now() });
  if (h.length > 100) h.splice(0, h.length - 100);
  saveHistory(h);
}

/* ══════════════════════════════════════
   CHAT MESSAGING
══════════════════════════════════════ */

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function appendMessage(role, text, isError = false) {
  // Save to history (skip error messages)
  if (!isError) pushHistory(role, text);

  // Hide welcome message on first real message
  if (welcomeMsg && welcomeMsg.parentNode) {
    welcomeMsg.style.opacity = "0";
    welcomeMsg.style.transform = "translateY(-10px)";
    welcomeMsg.style.transition = "all 0.3s ease";
    setTimeout(() => welcomeMsg.remove(), 300);
  }

  const row = document.createElement("div");
  row.className = `message-row ${role === "user" ? "user-row" : "bot-row"}${isError ? " error-bubble" : ""}`;

  const avatarLabel = role === "user" ? "U" : "J";
  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = avatarLabel;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;

  const meta = document.createElement("div");
  meta.className = "msg-time";
  meta.textContent = getTime();

  const inner = document.createElement("div");
  inner.style.display = "flex";
  inner.style.flexDirection = "column";
  inner.appendChild(bubble);
  inner.appendChild(meta);

  if (role === "user") {
    row.appendChild(inner);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(inner);
  }

  chatBox.appendChild(row);
  scrollToBottom();
  return bubble;
}

function appendTyping() {
  const wrap = document.createElement("div");
  wrap.className = "typing-indicator";
  wrap.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "J";

  const bubble = document.createElement("div");
  bubble.className = "typing-bubble";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "typing-dot";
    bubble.appendChild(dot);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  scrollToBottom();
}

function removeTyping() {
  const t = document.getElementById("typingIndicator");
  if (t) t.remove();
}

function scrollToBottom() {
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
}

async function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;

  appendMessage("user", msg);
  chatInput.value = "";
  autoResize(chatInput);
  sendBtn.disabled = true;

  appendTyping();

  try {
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });

    const data = await res.json();
    removeTyping();

    const reply = data.reply || "No response received.";
    appendMessage("bot", reply);

    // ✅ SPEAK reply (English, reliable)
    setTimeout(() => speak(reply), 300);
  } catch (err) {
    removeTyping();
    appendMessage("bot", "⚠️ Could not connect to server. Make sure the backend is running.", true);
  }

  sendBtn.disabled = false;
}

/* ══════════════════════════════════════
   INPUT HELPERS
══════════════════════════════════════ */

function handleInputKey(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChat();
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
window.addEventListener("load", () => {
  chatInput.focus();

  // Pre-load TTS voices
  if (window.speechSynthesis) {
    speechSynthesis.getVoices();

    // ✅ ADD THIS LINE HERE
    speechSynthesis.onvoiceschanged = () => {
      speechSynthesis.getVoices();
    };
  }
});

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
function goProfile() {
  window.location.href = "profile.html";
}

/* ══════════════════════════════════════
   SESSION TRACKING
══════════════════════════════════════ */
(function trackSession() {
  const sessions = parseInt(localStorage.getItem("jarvis-sessions") || "0");
  localStorage.setItem("jarvis-sessions", sessions + 1);
  localStorage.setItem("jarvis-last-login", Date.now().toString());
})();
